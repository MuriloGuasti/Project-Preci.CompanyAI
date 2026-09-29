import uuid
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import httpx
from app.core.config import settings

logger = logging.getLogger("preci.supabase_db")


def is_valid_uuid(val: str) -> bool:
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def ensure_uuid(val: Optional[str] = None) -> str:
    if val and is_valid_uuid(val):
        return str(val)
    return str(uuid.uuid4())


def get_headers() -> Dict[str, str]:
    key = settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_ANON_KEY
    return {
        "apikey": settings.SUPABASE_ANON_KEY or key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


# ==========================================
# CONVERSATIONS
# ==========================================

async def list_conversations_from_supabase(user_id: str, company_id: str) -> List[Dict[str, Any]]:
    if not settings.SUPABASE_URL:
        return None
    url = f"{settings.SUPABASE_URL}/rest/v1/conversations"
    params = {
        "user_id": f"eq.{user_id}",
        "company_id": f"eq.{company_id}",
        "order": "updated_at.desc",
        "select": "*",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=get_headers(), params=params)
            if resp.status_code == 200:
                return resp.json()
            logger.error(f"Error listing conversations from Supabase: {resp.status_code} {resp.text}")
            return None
    except Exception as e:
        logger.error(f"Exception listing conversations from Supabase: {e}")
        return None


async def create_conversation_in_supabase(
    conv_id: str,
    company_id: str,
    user_id: str,
    title: str = "Nova conversa",
    ai_model: str = "gemini-3.6-flash",
) -> Optional[Dict[str, Any]]:
    if not settings.SUPABASE_URL:
        return None
    url = f"{settings.SUPABASE_URL}/rest/v1/conversations"
    payload = {
        "id": conv_id,
        "company_id": company_id,
        "user_id": user_id,
        "title": title,
        "ai_model": ai_model,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, headers=get_headers(), json=payload)
        if resp.status_code in (200, 201):
            data = resp.json()
            return data[0] if isinstance(data, list) and len(data) > 0 else payload
        logger.error(f"Error creating conversation in Supabase: {resp.status_code} {resp.text}")
        return None


async def update_conversation_in_supabase(
    conv_id: str,
    company_id: str,
    title: Optional[str] = None,
    ai_model: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    if not settings.SUPABASE_URL:
        return None
    url = f"{settings.SUPABASE_URL}/rest/v1/conversations"
    params = {
        "id": f"eq.{conv_id}",
        "company_id": f"eq.{company_id}",
    }
    update_data: Dict[str, Any] = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if title is not None:
        update_data["title"] = title
    if ai_model is not None:
        update_data["ai_model"] = ai_model

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.patch(url, headers=get_headers(), params=params, json=update_data)
        if resp.status_code in (200, 204):
            data = resp.json() if resp.text else []
            return data[0] if isinstance(data, list) and len(data) > 0 else update_data
        logger.error(f"Error updating conversation in Supabase: {resp.status_code} {resp.text}")
        return None


async def delete_conversation_in_supabase(conv_id: str, company_id: str) -> bool:
    if not settings.SUPABASE_URL:
        return False
    url = f"{settings.SUPABASE_URL}/rest/v1/conversations"
    params = {
        "id": f"eq.{conv_id}",
        "company_id": f"eq.{company_id}",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.delete(url, headers=get_headers(), params=params)
        if resp.status_code in (200, 204):
            return True
        logger.error(f"Error deleting conversation in Supabase: {resp.status_code} {resp.text}")
        return False


# ==========================================
# MESSAGES
# ==========================================

async def list_messages_from_supabase(conv_id: str, company_id: str) -> List[Dict[str, Any]]:
    if not settings.SUPABASE_URL:
        return []
    url = f"{settings.SUPABASE_URL}/rest/v1/messages"
    params = {
        "conversation_id": f"eq.{conv_id}",
        "company_id": f"eq.{company_id}",
        "order": "created_at.asc",
        "select": "*",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, headers=get_headers(), params=params)
        if resp.status_code == 200:
            return resp.json()
        logger.error(f"Error listing messages from Supabase: {resp.status_code} {resp.text}")
        return []


async def create_message_in_supabase(
    msg_id: str,
    conv_id: str,
    company_id: str,
    role: str,
    content: str,
    attachments: Optional[List[Dict[str, Any]]] = None,
    tokens_used: int = 0,
) -> Optional[Dict[str, Any]]:
    if not settings.SUPABASE_URL:
        return None
    url = f"{settings.SUPABASE_URL}/rest/v1/messages"
    payload = {
        "id": msg_id,
        "conversation_id": conv_id,
        "company_id": company_id,
        "role": role,
        "content": content,
        "attachments": attachments or [],
        "tokens_used": tokens_used,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, headers=get_headers(), json=payload)
        if resp.status_code in (200, 201):
            data = resp.json()
            return data[0] if isinstance(data, list) and len(data) > 0 else payload
        logger.error(f"Error creating message in Supabase: {resp.status_code} {resp.text}")
        return None


# ==========================================
# DOCUMENT FOLDERS
# ==========================================

async def list_folders_from_supabase(company_id: str, user_id: str) -> Optional[List[Dict[str, Any]]]:
    if not settings.SUPABASE_URL:
        return None
    url = f"{settings.SUPABASE_URL}/rest/v1/document_folders"
    params = {
        "company_id": f"eq.{company_id}",
        "created_by": f"eq.{user_id}",
        "order": "name.asc",
        "select": "*",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=get_headers(), params=params)
            if resp.status_code == 200:
                return resp.json()
            logger.error(f"Error listing folders from Supabase: {resp.status_code} {resp.text}")
            return None
    except Exception as e:
        logger.error(f"Exception listing folders from Supabase: {e}")
        return None


async def create_folder_in_supabase(
    folder_id: str,
    company_id: str,
    user_id: str,
    name: str,
    parent_folder_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    if not settings.SUPABASE_URL:
        return None
    url = f"{settings.SUPABASE_URL}/rest/v1/document_folders"
    payload = {
        "id": folder_id,
        "company_id": company_id,
        "created_by": user_id,
        "name": name,
        "parent_folder_id": parent_folder_id if parent_folder_id and is_valid_uuid(parent_folder_id) else None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, headers=get_headers(), json=payload)
        if resp.status_code in (200, 201):
            data = resp.json()
            return data[0] if isinstance(data, list) and len(data) > 0 else payload
        logger.error(f"Error creating folder in Supabase: {resp.status_code} {resp.text}")
        return None


async def delete_folder_in_supabase(folder_id: str, company_id: str, user_id: Optional[str] = None) -> bool:
    if not settings.SUPABASE_URL:
        return False
    url = f"{settings.SUPABASE_URL}/rest/v1/document_folders"
    params = {
        "id": f"eq.{folder_id}",
        "company_id": f"eq.{company_id}",
    }
    if user_id:
        params["created_by"] = f"eq.{user_id}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.delete(url, headers=get_headers(), params=params)
        if resp.status_code in (200, 204):
            return True
        logger.error(f"Error deleting folder from Supabase: {resp.status_code} {resp.text}")
        return False


# ==========================================
# DOCUMENTS & CHUNKS (RAG)
# ==========================================

async def list_documents_from_supabase(
    company_id: str,
    user_id: str,
    folder_id: Optional[str] = None,
) -> Optional[List[Dict[str, Any]]]:
    if not settings.SUPABASE_URL:
        return None
    url = f"{settings.SUPABASE_URL}/rest/v1/documents"
    params = {
        "company_id": f"eq.{company_id}",
        "created_by": f"eq.{user_id}",
        "order": "created_at.desc",
        "select": "*",
    }
    if folder_id and is_valid_uuid(folder_id):
        params["folder_id"] = f"eq.{folder_id}"
    elif folder_id == "root":
        params["folder_id"] = "is.null"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=get_headers(), params=params)
            if resp.status_code == 200:
                return resp.json()
            logger.error(f"Error listing documents from Supabase: {resp.status_code} {resp.text}")
            return None
    except Exception as e:
        logger.error(f"Exception listing documents from Supabase: {e}")
        return None


async def create_document_in_supabase(
    doc_id: str,
    company_id: str,
    user_id: str,
    name: str,
    file_path: str,
    file_type: str,
    file_size: int,
    folder_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    if not settings.SUPABASE_URL:
        return None
    url = f"{settings.SUPABASE_URL}/rest/v1/documents"
    now_iso = datetime.now(timezone.utc).isoformat()
    payload = {
        "id": doc_id,
        "company_id": company_id,
        "created_by": user_id,
        "name": name,
        "file_path": file_path,
        "file_type": file_type,
        "file_size": file_size,
        "status": "ready",
        "folder_id": folder_id if folder_id and is_valid_uuid(folder_id) else None,
        "created_at": now_iso,
        "updated_at": now_iso,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(url, headers=get_headers(), json=payload)
        if resp.status_code in (200, 201):
            data = resp.json()
            return data[0] if isinstance(data, list) and len(data) > 0 else payload
        logger.error(f"Error creating document in Supabase: {resp.status_code} {resp.text}")
        return None


async def delete_document_from_supabase(doc_id: str, company_id: str, user_id: Optional[str] = None) -> bool:
    if not settings.SUPABASE_URL:
        return False
    url = f"{settings.SUPABASE_URL}/rest/v1/documents"
    params = {
        "id": f"eq.{doc_id}",
        "company_id": f"eq.{company_id}",
    }
    if user_id:
        params["created_by"] = f"eq.{user_id}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.delete(url, headers=get_headers(), params=params)
        if resp.status_code in (200, 204):
            return True
        logger.error(f"Error deleting document from Supabase: {resp.status_code} {resp.text}")
        return False


async def create_document_chunks_in_supabase(chunks: List[Dict[str, Any]]) -> bool:
    if not settings.SUPABASE_URL or not chunks:
        return False
    url = f"{settings.SUPABASE_URL}/rest/v1/document_chunks"
    async with httpx.AsyncClient(timeout=20.0) as client:
        resp = await client.post(url, headers=get_headers(), json=chunks)
        if resp.status_code in (200, 201):
            return True
        logger.error(f"Error creating document chunks in Supabase: {resp.status_code} {resp.text}")
        return False


async def get_document_chunks_from_supabase(
    doc_id: str,
    company_id: str,
) -> List[Dict[str, Any]]:
    if not settings.SUPABASE_URL:
        return []
    url = f"{settings.SUPABASE_URL}/rest/v1/document_chunks"
    params = {
        "document_id": f"eq.{doc_id}",
        "company_id": f"eq.{company_id}",
        "order": "chunk_index.asc",
        "select": "id,chunk_index,content",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, headers=get_headers(), params=params)
        if resp.status_code == 200:
            return resp.json()
        logger.error(f"Error fetching chunks from Supabase: {resp.status_code} {resp.text}")
        return []


async def search_document_chunks_in_supabase(
    company_id: str,
    user_id: str,
    query_embedding: List[float],
    match_count: int = 5,
    match_threshold: float = 0.25,
) -> List[Dict[str, Any]]:
    if not settings.SUPABASE_URL:
        return []

    # 1. Obtém a lista de documentos pertencentes a este usuário nesta empresa
    user_docs = await list_documents_from_supabase(company_id=company_id, user_id=user_id)
    if not user_docs:
        return []
    user_doc_ids = {d["id"] for d in user_docs}

    # 2. Tenta via RPC nativa match_document_chunks no Supabase
    rpc_url = f"{settings.SUPABASE_URL}/rest/v1/rpc/match_document_chunks"
    rpc_payload = {
        "query_embedding": query_embedding,
        "match_threshold": match_threshold,
        "match_count": match_count * 2,
        "p_company_id": company_id if is_valid_uuid(company_id) else None,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(rpc_url, headers=get_headers(), json=rpc_payload)
            if resp.status_code == 200:
                raw_results = resp.json()
                if raw_results and len(raw_results) > 0:
                    # Filtra estritamente apenas chunks dos documentos do usuário
                    filtered = [
                        r for r in raw_results
                        if r.get("document_id") in user_doc_ids
                        or (r.get("metadata") or {}).get("created_by") == user_id
                    ]
                    if filtered:
                        return filtered[:match_count]
    except Exception as e:
        logger.warning(f"Supabase RPC match_document_chunks error or pending: {e}")

    # 3. Fallback resiliente: busca chunks da empresa e filtra por documentos do usuário
    try:
        import numpy as np
        url = f"{settings.SUPABASE_URL}/rest/v1/document_chunks"
        params = {
            "company_id": f"eq.{company_id}",
            "select": "id,document_id,content,metadata,embedding",
            "limit": "200",
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=get_headers(), params=params)
            if resp.status_code != 200:
                return []
            raw_chunks = resp.json()

        q_vec = np.array(query_embedding, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            return []

        scored = []
        for ch in raw_chunks:
            # Filtro de propriedade de documento por usuário
            if ch.get("document_id") not in user_doc_ids and (ch.get("metadata") or {}).get("created_by") != user_id:
                continue

            emb = ch.get("embedding")
            if not emb:
                continue
            if isinstance(emb, str):
                try:
                    import json
                    emb = json.loads(emb)
                except Exception:
                    emb = [float(x) for x in emb.strip("[]").split(",") if x.strip()]
            c_vec = np.array(emb, dtype=np.float32)
            c_norm = np.linalg.norm(c_vec)
            if c_norm == 0:
                continue
            sim = float(np.dot(q_vec, c_vec) / (q_norm * c_norm))
            if sim >= match_threshold:
                scored.append({
                    "id": ch["id"],
                    "document_id": ch["document_id"],
                    "content": ch["content"],
                    "metadata": ch.get("metadata") or {},
                    "similarity": sim,
                })

        scored.sort(key=lambda x: x["similarity"], reverse=True)
        return scored[:match_count]
    except Exception as e:
        logger.error(f"Error in fallback search_document_chunks: {e}")
        return []


async def search_document_chunks_fts_in_supabase(
    company_id: str,
    user_id: str,
    query_text: str,
    match_count: int = 12,
) -> List[Dict[str, Any]]:
    """Busca textual de chunks via Full-Text Search (tsvector) no Supabase."""
    if not settings.SUPABASE_URL or not query_text or not query_text.strip():
        return []

    # 1. Obtém documentos deste usuário nesta empresa para garantir isolamento
    user_docs = await list_documents_from_supabase(company_id=company_id, user_id=user_id)
    if not user_docs:
        return []
    user_doc_ids = {d["id"] for d in user_docs}

    # 2. Tenta via RPC nativa match_document_chunks_fts
    rpc_url = f"{settings.SUPABASE_URL}/rest/v1/rpc/match_document_chunks_fts"
    rpc_payload = {
        "query_text": query_text.strip(),
        "match_count": match_count * 2,
        "p_company_id": company_id if is_valid_uuid(company_id) else None,
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(rpc_url, headers=get_headers(), json=rpc_payload)
            if resp.status_code == 200:
                raw_results = resp.json()
                if raw_results and len(raw_results) > 0:
                    filtered = [
                        r for r in raw_results
                        if r.get("document_id") in user_doc_ids
                        or (r.get("metadata") or {}).get("created_by") == user_id
                    ]
                    if filtered:
                        return filtered[:match_count]
    except Exception as e:
        logger.warning(f"Supabase RPC match_document_chunks_fts error or pending: {e}")

    # 3. Fallback PostgREST via wfts ou ilike
    try:
        url = f"{settings.SUPABASE_URL}/rest/v1/document_chunks"
        clean_q = query_text.strip()
        params = {
            "company_id": f"eq.{company_id}",
            "select": "id,document_id,content,metadata",
            "content": f"ilike.*{clean_q}*",
            "limit": str(match_count * 2),
        }
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=get_headers(), params=params)
            if resp.status_code == 200:
                rows = resp.json()
                filtered = [
                    r for r in rows
                    if r.get("document_id") in user_doc_ids
                    or (r.get("metadata") or {}).get("created_by") == user_id
                ]
                return filtered[:match_count]
    except Exception as e:
        logger.error(f"Error in fallback search_document_chunks_fts: {e}")

    return []

