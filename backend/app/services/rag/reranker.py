from __future__ import annotations

import re
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

logger = logging.getLogger("preci.rag.reranker")

# Stopwords comuns em português para não disparar match com preposições e artigos
STOPWORDS_PT = {
    "de", "da", "do", "das", "dos", "em", "no", "na", "nos", "nas",
    "para", "por", "com", "sem", "sob", "sobre", "entre", "ate", "até",
    "um", "uma", "uns", "umas", "o", "a", "os", "as", "que", "qual",
    "quais", "quem", "como", "onde", "quando", "porque", "por que",
    "este", "esta", "estes", "estas", "esse", "essa", "esses", "essas",
    "aquele", "aquela", "aqueles", "aquelas", "isto", "isso", "aquilo",
    "se", "mas", "mais", "e", "ou", "nem", "ja", "já", "ao", "aos",
}


@dataclass
class ChunkResult:
    """Estrutura unificada de resultado de chunk após busca híbrida e reranking."""
    id: str
    document_id: str
    content: str
    metadata: Dict[str, Any] = field(default_factory=dict)
    similarity: Optional[float] = None
    vector_rank: Optional[int] = None
    text_rank: Optional[int] = None
    rrf_score: float = 0.0
    recency_boost: float = 0.0
    keyword_boost: float = 0.0
    final_score: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "document_id": self.document_id,
            "content": self.content,
            "metadata": self.metadata,
            "similarity": self.similarity if self.similarity is not None else self.final_score,
            "vector_rank": self.vector_rank,
            "text_rank": self.text_rank,
            "rrf_score": self.rrf_score,
            "recency_boost": self.recency_boost,
            "keyword_boost": self.keyword_boost,
            "final_score": self.final_score,
        }

    def __getitem__(self, item: str) -> Any:
        return self.to_dict()[item]

    def get(self, item: str, default: Any = None) -> Any:
        return self.to_dict().get(item, default)


def recency_boost(
    updated_at: Optional[Union[datetime, str]],
    max_boost: float = 0.10,
    half_life_days: int = 90,
) -> float:
    """
    Calcula boost heurístico baseado na idade do documento pai com decaimento exponencial.
    Boost máximo: +0.10 para documentos criados/atualizados hoje.
    Meia-vida: a cada 90 dias, o boost decai pela metade.
    """
    if not updated_at:
        return 0.0

    try:
        dt: Optional[datetime] = None
        if isinstance(updated_at, str):
            clean_str = updated_at.replace("Z", "+00:00")
            dt = datetime.fromisoformat(clean_str)
        elif isinstance(updated_at, datetime):
            dt = updated_at

        if dt is None:
            return 0.0

        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)
        age_days = (now - dt).total_seconds() / 86400.0
        age_days = max(0.0, age_days)

        decay = 0.5 ** (age_days / float(half_life_days))
        return round(float(max_boost * decay), 4)
    except Exception as e:
        logger.debug(f"Erro ao calcular recency_boost para {updated_at}: {e}")
        return 0.0


def exact_keyword_match(query: str, content: str) -> bool:
    """
    Verifica se algum termo significativo da query (nomes, códigos, números)
    ou a frase exata ocorre literalmente no texto do chunk (case-insensitive).
    """
    if not query or not content:
        return False

    q_lower = query.strip().lower()
    c_lower = content.lower()

    # 1. Match exato da query completa (para termos compostos como "Contrato Preci #4402")
    if len(q_lower) >= 3 and q_lower in c_lower:
        return True

    # 2. Extrai tokens alfanuméricos incluindo hífens e sustenidos (códigos como CLI-98234-XP)
    tokens = re.findall(r"[\w\#\-]+", q_lower)
    meaningful_tokens = [
        t for t in tokens
        if len(t) >= 2 and t not in STOPWORDS_PT
    ]

    for token in meaningful_tokens:
        # Palavras ou códigos identificadores
        if token in c_lower:
            return True

    return False


def rerank(
    candidates: List[ChunkResult],
    query: str,
    keyword_boost_val: float = 0.15,
    max_recency_boost: float = 0.10,
    half_life_days: int = 90,
) -> List[ChunkResult]:
    """
    Aplica reordenação heurística sobre os candidatos de busca híbrida:
    final_score = rrf_score + (0.15 if exact_keyword_match else 0) + recency_boost(doc.updated_at)
    """
    if not candidates:
        return []

    for candidate in candidates:
        # 1. Checa match exato de keyword
        has_exact = exact_keyword_match(query, candidate.content)
        kw_boost = keyword_boost_val if has_exact else 0.0

        # 2. Checa recência do documento no metadata
        doc_updated_at = (
            candidate.metadata.get("updated_at")
            or candidate.metadata.get("created_at")
            or candidate.metadata.get("document_updated_at")
        )
        rec_boost = recency_boost(
            doc_updated_at,
            max_boost=max_recency_boost,
            half_life_days=half_life_days,
        )

        candidate.keyword_boost = kw_boost
        candidate.recency_boost = rec_boost
        candidate.final_score = round(candidate.rrf_score + kw_boost + rec_boost, 5)

    # Ordena decrescente pelo score final
    ranked = sorted(candidates, key=lambda x: x.final_score, reverse=True)
    return ranked
