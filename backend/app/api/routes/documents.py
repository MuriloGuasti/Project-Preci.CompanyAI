import asyncio
import io
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Request
import pypdf

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.supabase_client import db
from app.db.supabase_db import (
    ensure_uuid,
    is_valid_uuid,
    list_folders_from_supabase,
    create_folder_in_supabase,
    delete_folder_in_supabase,
    list_documents_from_supabase,
    create_document_in_supabase,
    delete_document_from_supabase,
    create_document_chunks_in_supabase,
    get_document_chunks_from_supabase,
)
from app.models.schemas import (
    DocumentFolderCreate,
    DocumentFolderResponse,
    DocumentResponse,
    DocumentUploadRequest,
)
from app.services.rag.chunking import chunk_text
from app.services.rag.embeddings import generate_embedding

logger = logging.getLogger("preci.documents")

router = APIRouter(prefix="/documents", tags=["documents"])


def extract_text_from_bytes(content_bytes: bytes, filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".pdf"):
        try:
            reader = pypdf.PdfReader(io.BytesIO(content_bytes))
            pages_text = []
            for idx, page in enumerate(reader.pages):
                txt = page.extract_text()
                if txt:
                    pages_text.append(txt)
            return "\n\n".join(pages_text)
        except Exception as e:
            logger.error(f"Error reading PDF {filename}: {e}")
            return ""
    try:
        return content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        try:
            return content_bytes.decode("latin-1")
        except Exception as e:
            logger.error(f"Error decoding text file {filename}: {e}")
            return ""


# ==========================================
# FOLDERS
# ==========================================

@router.get("/folders", response_model=List[DocumentFolderResponse])
async def list_folders(current_user: dict = Depends(get_current_user)):
    company_id = current_user.get("company_id", "00000000-0000-0000-0000-000000000001")
    user_id = current_user["id"]
    
    # 1. Supabase
    if is_valid_uuid(company_id) and is_valid_uuid(user_id):
        sb_folders = await list_folders_from_supabase(company_id, user_id)
        if sb_folders is not None:
            return [
                DocumentFolderResponse(
                    id=f["id"],
                    name=f["name"],
                    parent_folder_id=f.get("parent_folder_id"),
                    created_at=f["created_at"],
                )
                for f in sb_folders
            ]

    # 2. Fallback memória
    folders = [
        DocumentFolderResponse(
            id=f["id"],
            name=f["name"],
            parent_folder_id=f.get("parent_folder_id"),
            created_at=f["created_at"],
        )
        for f in db.document_folders.values()
        if f.get("company_id") == company_id and f.get("created_by") == user_id
    ]
    return folders


@router.post("/folders", response_model=DocumentFolderResponse)
async def create_folder(
    payload: DocumentFolderCreate,
    current_user: dict = Depends(get_current_user),
):
    folder_id = ensure_uuid()
    company_id = current_user.get("company_id", "00000000-0000-0000-0000-000000000001")
    user_id = current_user["id"]
    now = datetime.now(timezone.utc)

    # 1. Supabase
    if is_valid_uuid(company_id) and is_valid_uuid(user_id):
        await create_folder_in_supabase(
            folder_id=folder_id,
            company_id=company_id,
            user_id=user_id,
            name=payload.name,
            parent_folder_id=payload.parent_folder_id,
        )

    # 2. Memória
    new_folder = {
        "id": folder_id,
        "company_id": company_id,
        "parent_folder_id": payload.parent_folder_id,
        "name": payload.name,
        "created_by": user_id,
        "created_at": now,
    }
    db.document_folders[folder_id] = new_folder

    return DocumentFolderResponse(
        id=folder_id,
        name=payload.name,
        parent_folder_id=payload.parent_folder_id,
        created_at=now,
    )


@router.delete("/folders/{folder_id}")
async def delete_folder(
    folder_id: str,
    current_user: dict = Depends(get_current_user),
):
    company_id = current_user.get("company_id", "00000000-0000-0000-0000-000000000001")
    user_id = current_user["id"]

    # Validação de propriedade em memória
    if folder_id in db.document_folders:
        f = db.document_folders[folder_id]
        if f.get("company_id") != company_id or f.get("created_by") != user_id:
            raise HTTPException(status_code=404, detail="Pasta não encontrada ou sem permissão")
        del db.document_folders[folder_id]
        to_del = [d_id for d_id, d in db.documents.items() if d.get("folder_id") == folder_id]
        for d_id in to_del:
            del db.documents[d_id]
            # Limpa chunks associados
            to_del_chunks = [c_id for c_id, c in db.document_chunks.items() if c.get("document_id") == d_id]
            for c_id in to_del_chunks:
                del db.document_chunks[c_id]

    if is_valid_uuid(folder_id) and is_valid_uuid(company_id):
        await delete_folder_in_supabase(folder_id, company_id, user_id)

    return {"ok": True}


# ==========================================
# DOCUMENTS
# ==========================================

@router.get("", response_model=List[DocumentResponse])
async def list_documents(
    folder_id: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    company_id = current_user.get("company_id", "00000000-0000-0000-0000-000000000001")
    user_id = current_user["id"]

    # 1. Supabase
    if is_valid_uuid(company_id) and is_valid_uuid(user_id):
        sb_docs = await list_documents_from_supabase(company_id, user_id, folder_id)
        if sb_docs is not None:
            return [
                DocumentResponse(
                    id=d["id"],
                    company_id=d["company_id"],
                    folder_id=d.get("folder_id"),
                    name=d["name"],
                    file_path=d.get("file_path", d["name"]),
                    file_type=d.get("file_type", "text/plain"),
                    file_size=d.get("file_size", 0),
                    status=d.get("status", "ready"),
                    created_at=d["created_at"],
                    updated_at=d["updated_at"],
                )
                for d in sb_docs
            ]

    # 2. Fallback Memória
    docs = []
    for d in db.documents.values():
        if d.get("company_id") == company_id and d.get("created_by") == user_id:
            if folder_id is not None:
                if d.get("folder_id") == folder_id:
                    docs.append(DocumentResponse(**d))
            else:
                docs.append(DocumentResponse(**d))
    docs.sort(key=lambda x: x.created_at, reverse=True)
    return docs


@router.post("/upload", response_model=DocumentResponse)
async def upload_document(
    request: Request,
    current_user: dict = Depends(get_current_user),
):
    company_id = current_user.get("company_id", "00000000-0000-0000-0000-000000000001")
    user_id = current_user["id"]
    now = datetime.now(timezone.utc)
    doc_id = ensure_uuid()

    content_type = request.headers.get("content-type", "")
    filename = "documento.txt"
    file_bytes = b""
    folder_id: Optional[str] = None
    file_type = "text/plain"

    # A) Requisição Multipart Form-Data (Upload Real do Arquivo)
    if "multipart/form-data" in content_type:
        form = await request.form()
        uploaded_file = form.get("file")
        folder_id = form.get("folder_id")
        if folder_id in ("null", "undefined", "", None):
            folder_id = None

        if uploaded_file and hasattr(uploaded_file, "read"):
            filename = getattr(uploaded_file, "filename", "documento.txt")
            file_type = getattr(uploaded_file, "content_type", "application/octet-stream")
            file_bytes = await uploaded_file.read()
    else:
        # B) Fallback JSON legado
        try:
            body = await request.json()
            filename = body.get("name", "documento.txt")
            folder_id = body.get("folder_id")
            file_type = body.get("file_type", "text/plain")
            file_bytes = body.get("content", "").encode("utf-8")
        except Exception:
            pass

    file_size = len(file_bytes)
    file_path = f"{company_id}/{filename}"

    # 1. Extração de texto para RAG
    extracted_text = extract_text_from_bytes(file_bytes, filename)
    if not extracted_text.strip():
        extracted_text = f"Documento: {filename} (arquivo recebido com {file_size} bytes)."

    # 2. Chunking do texto
    chunks_meta = chunk_text(extracted_text, chunk_size=400, overlap=40)
    if not chunks_meta:
        chunks_meta = [{"chunk_index": 0, "content": extracted_text[:2000]}]

    # 3. Geração de Embeddings com Google Gemini (gemini-embedding-2 / 1536 dim) com espaçamento
    chunks_to_insert = []
    for i, ch in enumerate(chunks_meta):
        chunk_content = ch["content"]
        if i > 0:
            await asyncio.sleep(0.4)  # Espaçamento para respeitar a cota TPM
        emb = await generate_embedding(chunk_content)
        chunk_id = ensure_uuid()
        chunks_to_insert.append({
            "id": chunk_id,
            "document_id": doc_id,
            "company_id": company_id,
            "content": chunk_content,
            "embedding": emb,
            "chunk_index": ch["chunk_index"],
            "metadata": {
                "document_name": filename,
                "folder_id": folder_id,
                "created_by": user_id,
            },
            "created_at": now.isoformat(),
        })

    # 4. Salva documento no Supabase
    if is_valid_uuid(company_id) and is_valid_uuid(user_id):
        await create_document_in_supabase(
            doc_id=doc_id,
            company_id=company_id,
            user_id=user_id,
            name=filename,
            file_path=file_path,
            file_type=file_type,
            file_size=file_size,
            folder_id=folder_id,
        )
        if chunks_to_insert:
            await create_document_chunks_in_supabase(chunks_to_insert)

    # 5. Salva em memória
    new_doc = {
        "id": doc_id,
        "company_id": company_id,
        "folder_id": folder_id,
        "name": filename,
        "file_path": file_path,
        "file_type": file_type,
        "file_size": file_size,
        "status": "ready",
        "created_by": user_id,
        "content": extracted_text,
        "created_at": now,
        "updated_at": now,
    }
    db.documents[doc_id] = new_doc

    # Salva chunks em db.document_chunks para RAG in-memory / local
    for ch_item in chunks_to_insert:
        db.document_chunks[ch_item["id"]] = {**ch_item, "created_by": user_id}

    return DocumentResponse(**new_doc)


@router.get("/{doc_id}/preview")
async def get_document_preview(
    doc_id: str,
    current_user: dict = Depends(get_current_user),
):
    company_id = current_user.get("company_id", "00000000-0000-0000-0000-000000000001")
    user_id = current_user["id"]

    content = ""
    doc_name = "Documento"
    file_type = "text/plain"
    file_size = 0
    created_at = None
    folder_id = None

    # 1. Checa memória
    if doc_id in db.documents:
        doc = db.documents[doc_id]
        if doc.get("company_id") == company_id and doc.get("created_by") == user_id:
            content = doc.get("content", "")
            doc_name = doc.get("name", doc_name)
            file_type = doc.get("file_type", file_type)
            file_size = doc.get("file_size", 0)
            created_at = doc.get("created_at")
            folder_id = doc.get("folder_id")

    # 2. Se não achou na memória ou falta conteúdo, busca no Supabase
    if is_valid_uuid(company_id) and is_valid_uuid(doc_id):
        if not content:
            chunks = await get_document_chunks_from_supabase(doc_id, company_id)
            if chunks:
                content = "\n\n".join([c.get("content", "") for c in chunks if c.get("content")])

        if doc_name == "Documento":
            sb_docs = await list_documents_from_supabase(company_id, user_id)
            for d in (sb_docs or []):
                if d.get("id") == doc_id:
                    doc_name = d.get("name", doc_name)
                    file_type = d.get("file_type", file_type)
                    file_size = d.get("file_size", 0)
                    created_at = d.get("created_at")
                    folder_id = d.get("folder_id")
                    break

    return {
        "id": doc_id,
        "name": doc_name,
        "folder_id": folder_id,
        "file_type": file_type,
        "file_size": file_size,
        "created_at": created_at,
        "content": content or "Documento indexado para busca semântica com Google Gemini.",
        "has_content": bool(content.strip()),
    }


@router.delete("/{doc_id}")
async def delete_document(
    doc_id: str,
    current_user: dict = Depends(get_current_user),
):
    company_id = current_user.get("company_id", "00000000-0000-0000-0000-000000000001")
    user_id = current_user["id"]

    if doc_id in db.documents:
        doc = db.documents[doc_id]
        if doc.get("company_id") != company_id or doc.get("created_by") != user_id:
            raise HTTPException(status_code=404, detail="Documento não encontrado ou sem permissão")
        del db.documents[doc_id]
        # Deleta chunks associados
        to_del_chunks = [c_id for c_id, c in db.document_chunks.items() if c.get("document_id") == doc_id]
        for c_id in to_del_chunks:
            del db.document_chunks[c_id]

    if is_valid_uuid(doc_id) and is_valid_uuid(company_id):
        await delete_document_from_supabase(doc_id, company_id, user_id)

    return {"ok": True}
