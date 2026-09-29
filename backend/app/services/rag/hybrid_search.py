from __future__ import annotations

import asyncio
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np

from app.core.config import settings
from app.db.supabase_client import db
from app.db.supabase_db import (
    is_valid_uuid,
    search_document_chunks_in_supabase,
    search_document_chunks_fts_in_supabase,
)
from app.services.rag.embeddings import generate_embedding
from app.services.rag.reranker import ChunkResult, rerank, STOPWORDS_PT

logger = logging.getLogger("preci.rag.hybrid_search")

# Constante padrão da literatura para Reciprocal Rank Fusion
RRF_K = 60


def compute_rrf_score(
    vector_rank: Optional[int],
    text_rank: Optional[int],
    k: int = RRF_K,
) -> float:
    """
    Calcula a pontuação de Reciprocal Rank Fusion (RRF):
    RRF_score(chunk) = Σ 1 / (k + rank)
    """
    score = 0.0
    if vector_rank is not None and vector_rank > 0:
        score += 1.0 / (k + vector_rank)
    if text_rank is not None and text_rank > 0:
        score += 1.0 / (k + text_rank)
    return round(score, 6)


def _tokenize_query_pt(query: str) -> List[str]:
    """Extrai tokens significativos em português para busca textual exata."""
    clean = query.lower()
    raw_tokens = re.findall(r"[\w\#\-]+", clean)
    return [t for t in raw_tokens if len(t) >= 2 and t not in STOPWORDS_PT]


def _score_text_in_memory(query: str, query_tokens: List[str], text: str) -> float:
    """Calcula score textual (BM25-like simplificado) em memória."""
    if not text:
        return 0.0
    text_lower = text.lower()
    score = 0.0

    # Match de frase exata confere pontuação de destaque
    clean_q = query.strip().lower()
    if len(clean_q) >= 4 and clean_q in text_lower:
        score += 5.0

    # Match de tokens individuais significativos
    for t in query_tokens:
        count = text_lower.count(t)
        if count > 0:
            score += 1.0 + min(count * 0.5, 2.0)

    return score


async def _search_in_memory(
    query: str,
    query_embedding: Optional[List[float]],
    company_id: Optional[str] = None,
    user_id: Optional[str] = None,
    folder_id: Optional[str] = None,
    threshold: float = 0.25,
    top_k_expanded: int = 12,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """Executa busca vetorial e textual nos chunks armazenados em memória."""
    # 1. Filtra chunks candidatos por tenant, usuário e pasta
    all_chunks: List[Dict[str, Any]] = list(db.document_chunks.values())

    # Se db.document_chunks estiver vazio, constrói chunks dinâmicos a partir de db.documents
    if not all_chunks and db.documents:
        for doc_id, doc in db.documents.items():
            content = doc.get("extracted_text") or doc.get("content") or ""
            if not content:
                continue
            paras = [p.strip() for p in content.split("\n\n") if len(p.strip()) > 20]
            for idx, p in enumerate(paras):
                chunk_id = f"{doc_id}-chunk-{idx}"
                all_chunks.append({
                    "id": chunk_id,
                    "document_id": doc_id,
                    "company_id": doc.get("company_id"),
                    "created_by": doc.get("created_by") or doc.get("user_id"),
                    "content": p,
                    "metadata": {
                        "document_name": doc.get("name", "Documento"),
                        "created_at": doc.get("created_at"),
                        "updated_at": doc.get("updated_at"),
                        "folder_id": doc.get("folder_id"),
                    },
                    "embedding": doc.get("embedding"),
                })

    eligible_chunks = []
    for c in all_chunks:
        if company_id and c.get("company_id") and c.get("company_id") != company_id:
            continue
        c_user = c.get("created_by") or (c.get("metadata") or {}).get("created_by")
        if user_id and c_user and c_user != user_id:
            continue
        c_folder = (c.get("metadata") or {}).get("folder_id") or c.get("folder_id")
        if folder_id and c_folder and c_folder != folder_id:
            continue
        eligible_chunks.append(c)

    # 2. Busca Vetorial em memória
    vector_results: List[Dict[str, Any]] = []
    if query_embedding:
        q_vec = np.array(query_embedding, dtype=np.float32)
        q_norm = float(np.linalg.norm(q_vec))
        if q_norm > 0:
            scored_vec = []
            for c in eligible_chunks:
                emb = c.get("embedding")
                if not emb:
                    continue
                c_vec = np.array(emb, dtype=np.float32)
                c_norm = float(np.linalg.norm(c_vec))
                if c_norm > 0:
                    sim = float(np.dot(q_vec, c_vec) / (q_norm * c_norm))
                    if sim >= threshold:
                        scored_vec.append({**c, "similarity": sim})
            scored_vec.sort(key=lambda x: x["similarity"], reverse=True)
            vector_results = scored_vec[:top_k_expanded]

    # 3. Busca Textual em memória
    query_tokens = _tokenize_query_pt(query)
    scored_text = []
    for c in eligible_chunks:
        c_text = c.get("content", "")
        doc_name = (c.get("metadata") or {}).get("document_name", "")
        full_haystack = f"{doc_name} {c_text}"
        score = _score_text_in_memory(query, query_tokens, full_haystack)
        if score > 0:
            scored_text.append({**c, "text_score": score})

    scored_text.sort(key=lambda x: x["text_score"], reverse=True)
    text_results = scored_text[:top_k_expanded]

    return vector_results, text_results


async def hybrid_search(
    query: str,
    company_id: Optional[str] = None,
    user_id: Optional[str] = None,
    top_k: int = 4,
    threshold: float = 0.25,
    folder_id: Optional[str] = None,
) -> List[ChunkResult]:
    """
    Busca Híbrida combinando pgvector (cosseno) + Full-Text Search (tsvector/BM25)
    via Reciprocal Rank Fusion (RRF, k=60), com etapa subsequente de Reranking heurístico.
    """
    clean_query = query.strip()
    if not clean_query:
        return []

    top_k_expanded = max(top_k * 3, 12)
    top_k_candidates = max(top_k * 2, 8)

    raw_vector_results: List[Dict[str, Any]] = []
    raw_text_results: List[Dict[str, Any]] = []

    # 1. Supabase (produção / conectado)
    used_supabase = False
    if settings.SUPABASE_URL and company_id and is_valid_uuid(company_id) and user_id and is_valid_uuid(user_id):
        try:
            # Gera embedding com fallback
            q_emb = await generate_embedding(clean_query)

            # Executa busca vetorial e textual em paralelo
            vec_task = search_document_chunks_in_supabase(
                company_id=company_id,
                user_id=user_id,
                query_embedding=q_emb,
                match_count=top_k_expanded,
                match_threshold=threshold,
            )
            fts_task = search_document_chunks_fts_in_supabase(
                company_id=company_id,
                user_id=user_id,
                query_text=clean_query,
                match_count=top_k_expanded,
            )

            res_vec, res_fts = await asyncio.gather(vec_task, fts_task, return_exceptions=True)
            if not isinstance(res_vec, Exception) and res_vec:
                raw_vector_results = res_vec
                used_supabase = True
            if not isinstance(res_fts, Exception) and res_fts:
                raw_text_results = res_fts
                used_supabase = True
        except Exception as sb_err:
            logger.warning(f"Erro na busca híbrida via Supabase, aplicando fallback in-memory: {sb_err}")

    # 2. Fallback In-Memory (Zero Quota / testes locais)
    if not used_supabase or (not raw_vector_results and not raw_text_results):
        try:
            q_emb = await generate_embedding(clean_query)
        except Exception:
            q_emb = None

        mem_vec, mem_text = await _search_in_memory(
            query=clean_query,
            query_embedding=q_emb,
            company_id=company_id,
            user_id=user_id,
            folder_id=folder_id,
            threshold=threshold,
            top_k_expanded=top_k_expanded,
        )
        if not raw_vector_results:
            raw_vector_results = mem_vec
        if not raw_text_results:
            raw_text_results = mem_text

    # 3. Mapeamento de ranks (1-indexed) para Reciprocal Rank Fusion
    chunk_map: Dict[str, ChunkResult] = {}

    # Atribui ranks vetoriais
    for idx, item in enumerate(raw_vector_results):
        cid = str(item["id"])
        doc_id = str(item.get("document_id") or "")
        content = item.get("content") or ""
        metadata = item.get("metadata") or {}
        similarity = item.get("similarity")

        chunk_map[cid] = ChunkResult(
            id=cid,
            document_id=doc_id,
            content=content,
            metadata=metadata,
            similarity=similarity,
            vector_rank=idx + 1,
        )

    # Atribui ranks textuais
    for idx, item in enumerate(raw_text_results):
        cid = str(item["id"])
        if cid in chunk_map:
            chunk_map[cid].text_rank = idx + 1
        else:
            doc_id = str(item.get("document_id") or "")
            content = item.get("content") or ""
            metadata = item.get("metadata") or {}
            similarity = item.get("similarity")

            chunk_map[cid] = ChunkResult(
                id=cid,
                document_id=doc_id,
                content=content,
                metadata=metadata,
                similarity=similarity,
                text_rank=idx + 1,
            )

    if not chunk_map:
        return []

    # 4. Calcula RRF Score
    for chunk in chunk_map.values():
        chunk.rrf_score = compute_rrf_score(chunk.vector_rank, chunk.text_rank, k=RRF_K)

    # 5. Seleciona os melhores candidatos para reranking (top_k * 2)
    sorted_by_rrf = sorted(chunk_map.values(), key=lambda x: x.rrf_score, reverse=True)
    candidates = sorted_by_rrf[:top_k_candidates]

    # 6. Aplica Reranking Heurístico (+0.15 exact match, decaimento de recência)
    reranked = rerank(candidates, query=clean_query)

    # 7. Corta no top_k final solicitado
    final_results = reranked[:top_k]
    return final_results
