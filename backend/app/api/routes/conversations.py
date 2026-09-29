import asyncio
import uuid
import json
import base64
import io
import logging
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from app.api.deps import get_current_user
from app.db.supabase_client import db
from app.db.supabase_db import (
    ensure_uuid,
    is_valid_uuid,
    list_conversations_from_supabase,
    create_conversation_in_supabase,
    update_conversation_in_supabase,
    delete_conversation_in_supabase,
    list_messages_from_supabase,
    create_message_in_supabase,
    search_document_chunks_in_supabase as search_document_chunks,
)
from app.services.rag.hybrid_search import hybrid_search
from app.models.schemas import (
    ConversationCreate,
    ConversationResponse,
    MessageCreate,
    MessageResponse,
    AIModelInfo,
)
from app.services.ai.models_config import MODELS
from app.services.ai.router import stream_chat
from app.services.rag.embeddings import generate_embedding

logger = logging.getLogger("preci.conversations")

router = APIRouter(prefix="/conversations", tags=["conversations"])


@router.get("/models", response_model=List[AIModelInfo])
async def list_ai_models():
    models = []
    for m_id, cfg in MODELS.items():
        models.append(
            AIModelInfo(
                id=m_id,
                provider=cfg["provider"],
                display_name=cfg["display_name"],
                enabled=cfg["enabled"],
                max_tokens=cfg["max_tokens"],
            )
        )
    return models


@router.get("", response_model=List[ConversationResponse])
async def list_conversations(current_user: dict = Depends(get_current_user)):
    user_id = current_user["id"]
    company_id = current_user.get("company_id", "00000000-0000-0000-0000-000000000001")

    # 1. Tenta carregar do Supabase real
    if is_valid_uuid(user_id) and is_valid_uuid(company_id):
        sb_convs = await list_conversations_from_supabase(user_id=user_id, company_id=company_id)
        if sb_convs is not None:
            # Sincroniza em memória também
            for c in sb_convs:
                db.conversations[c["id"]] = c
            return [
                ConversationResponse(
                    id=c["id"],
                    title=c["title"],
                    ai_model=c.get("ai_model", "gemini-3.6-flash"),
                    created_at=c["created_at"],
                    updated_at=c["updated_at"],
                )
                for c in sb_convs
            ]

    # 2. Fallback de memória local
    convs = [
        ConversationResponse(
            id=c["id"],
            title=c["title"],
            ai_model=c.get("ai_model", "gemini-3.6-flash"),
            created_at=c["created_at"],
            updated_at=c["updated_at"],
        )
        for c in db.conversations.values()
        if c.get("user_id") == user_id and c.get("company_id") == company_id
    ]
    convs.sort(key=lambda x: x.updated_at, reverse=True)
    return convs


@router.post("", response_model=ConversationResponse)
async def create_conversation(
    payload: ConversationCreate,
    current_user: dict = Depends(get_current_user),
):
    conv_id = ensure_uuid(payload.id)
    company_id = current_user.get("company_id", "00000000-0000-0000-0000-000000000001")
    user_id = current_user["id"]
    title = payload.title or "Nova conversa"
    ai_model = payload.ai_model or "gemini-3.6-flash"

    # 1. Tenta criar no Supabase
    sb_created = None
    if is_valid_uuid(user_id) and is_valid_uuid(company_id):
        sb_created = await create_conversation_in_supabase(
            conv_id=conv_id,
            company_id=company_id,
            user_id=user_id,
            title=title,
            ai_model=ai_model,
        )

    now = datetime.now(timezone.utc)
    new_conv = {
        "id": conv_id,
        "company_id": company_id,
        "user_id": user_id,
        "title": title,
        "ai_model": ai_model,
        "created_at": sb_created.get("created_at") if sb_created else now,
        "updated_at": sb_created.get("updated_at") if sb_created else now,
    }
    db.conversations[conv_id] = new_conv
    if conv_id not in db.messages:
        db.messages[conv_id] = []

    return ConversationResponse(**new_conv)


@router.patch("/{conv_id}", response_model=ConversationResponse)
async def update_conversation(
    conv_id: str,
    payload: dict,
    current_user: dict = Depends(get_current_user),
):
    company_id = current_user.get("company_id", "00000000-0000-0000-0000-000000000001")
    user_id = current_user["id"]
    title = payload.get("title")
    ai_model = payload.get("ai_model")

    # 1. Atualiza no Supabase se UUID válido
    if is_valid_uuid(conv_id) and is_valid_uuid(company_id):
        await update_conversation_in_supabase(
            conv_id=conv_id,
            company_id=company_id,
            title=title,
            ai_model=ai_model,
        )

    # 2. Atualiza em memória
    now = datetime.now(timezone.utc)
    if conv_id in db.conversations:
        conv = db.conversations[conv_id]
        if conv.get("user_id") != user_id or conv.get("company_id") != company_id:
            raise HTTPException(status_code=404, detail="Conversa não encontrada ou sem permissão")
        if title is not None:
            conv["title"] = title
        if ai_model is not None:
            conv["ai_model"] = ai_model
        conv["updated_at"] = now
        return ConversationResponse(**conv)

    return ConversationResponse(
        id=conv_id,
        title=title or "Conversa",
        ai_model=ai_model or "gemini-3.6-flash",
        created_at=now,
        updated_at=now,
    )


@router.delete("/{conv_id}")
async def delete_conversation(
    conv_id: str,
    current_user: dict = Depends(get_current_user),
):
    company_id = current_user.get("company_id", "00000000-0000-0000-0000-000000000001")
    user_id = current_user["id"]

    # 1. Valida e limpa em memória
    if conv_id in db.conversations:
        conv = db.conversations[conv_id]
        if conv.get("user_id") != user_id or conv.get("company_id") != company_id:
            raise HTTPException(status_code=404, detail="Conversa não encontrada ou sem permissão")
        del db.conversations[conv_id]
    if conv_id in db.messages:
        del db.messages[conv_id]

    # 2. Deleta no Supabase
    if is_valid_uuid(conv_id) and is_valid_uuid(company_id):
        await delete_conversation_in_supabase(conv_id=conv_id, company_id=company_id)

    return {"ok": True}


@router.get("/{conv_id}/messages", response_model=List[MessageResponse])
async def get_conversation_messages(
    conv_id: str,
    current_user: dict = Depends(get_current_user),
):
    company_id = current_user.get("company_id", "00000000-0000-0000-0000-000000000001")
    user_id = current_user["id"]

    if conv_id in db.conversations:
        conv = db.conversations[conv_id]
        if conv.get("user_id") != user_id or conv.get("company_id") != company_id:
            raise HTTPException(status_code=404, detail="Conversa não encontrada ou sem permissão")

    # 1. Tenta carregar do Supabase
    if is_valid_uuid(conv_id) and is_valid_uuid(company_id):
        sb_msgs = await list_messages_from_supabase(conv_id=conv_id, company_id=company_id)
        if sb_msgs:
            db.messages[conv_id] = sb_msgs
            return [
                MessageResponse(
                    id=m["id"],
                    conversation_id=m["conversation_id"],
                    role=m["role"],
                    content=m["content"],
                    attachments=[a for a in (m.get("attachments") or []) if isinstance(a, dict) and a.get("type") != "interrupted"],
                    created_at=m["created_at"],
                    is_interrupted=bool(m.get("is_interrupted") or any(isinstance(a, dict) and a.get("type") == "interrupted" for a in (m.get("attachments") or []))),
                )
                for m in sb_msgs
            ]

    # 2. Fallback de memória
    msgs = db.messages.get(conv_id, [])
    return [
        MessageResponse(
            id=m["id"],
            conversation_id=m.get("conversation_id", conv_id),
            role=m["role"],
            content=m["content"],
            attachments=[a for a in (m.get("attachments") or []) if isinstance(a, dict) and a.get("type") != "interrupted"],
            created_at=m.get("created_at") or datetime.now(timezone.utc),
            is_interrupted=bool(m.get("is_interrupted") or any(isinstance(a, dict) and a.get("type") == "interrupted" for a in (m.get("attachments") or []))),
        )
        for m in msgs
    ]


@router.post("/{conv_id}/messages")
async def send_message(
    conv_id: str,
    payload: MessageCreate,
    current_user: dict = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    company_id = current_user.get("company_id", "00000000-0000-0000-0000-000000000001")
    user_id = current_user["id"]

    # Garante que a conversa existe no Supabase e em memória
    conv = db.conversations.get(conv_id)
    if not conv and is_valid_uuid(conv_id):
        # Tenta criar no Supabase
        first_title = payload.content.strip()[:30] or "Nova conversa"
        if len(payload.content.strip()) > 30:
            first_title += "..."
        await create_conversation_in_supabase(
            conv_id=conv_id,
            company_id=company_id,
            user_id=user_id,
            title=first_title,
            ai_model="gemini-3.6-flash",
        )
        db.conversations[conv_id] = {
            "id": conv_id,
            "company_id": company_id,
            "user_id": user_id,
            "title": first_title,
            "ai_model": "gemini-3.6-flash",
            "created_at": now,
            "updated_at": now,
        }
        db.messages[conv_id] = []
        conv = db.conversations[conv_id]

    # 1. Salva mensagem do usuário
    user_msg_id = ensure_uuid()
    if is_valid_uuid(conv_id):
        await create_message_in_supabase(
            msg_id=user_msg_id,
            conv_id=conv_id,
            company_id=company_id,
            role="user",
            content=payload.content,
            attachments=payload.attachments,
        )

    user_msg = {
        "id": user_msg_id,
        "conversation_id": conv_id,
        "role": "user",
        "content": payload.content,
        "attachments": payload.attachments or [],
        "created_at": now,
    }
    if conv_id not in db.messages:
        db.messages[conv_id] = []
    db.messages[conv_id].append(user_msg)

    # Se for a 1ª mensagem, atualiza o título no Supabase
    if len(db.messages[conv_id]) == 1 and conv:
        first_title = payload.content.strip()[:30]
        if len(payload.content.strip()) > 30:
            first_title += "..."
        conv["title"] = first_title
        if is_valid_uuid(conv_id):
            await update_conversation_in_supabase(
                conv_id=conv_id,
                company_id=company_id,
                title=first_title,
            )
    else:
        if is_valid_uuid(conv_id):
            await update_conversation_in_supabase(
                conv_id=conv_id,
                company_id=company_id,
            )

    if conv:
        conv["updated_at"] = now

    ai_prompt_content = payload.content or ""

    # Processa anexos enviados pelo usuário na conversa
    attached_texts = []
    if payload.attachments:
        for att in payload.attachments:
            name = att.get("name", "arquivo")
            raw_b64 = att.get("data")
            if not raw_b64 and att.get("url", "").startswith("data:"):
                raw_b64 = att["url"].split(",")[1]
            ext = name.split(".")[-1].lower() if "." in name else ""
            att_type = att.get("type", "")

            if raw_b64:
                try:
                    file_bytes = base64.b64decode(raw_b64)
                    if att_type == "application/pdf" or ext == "pdf":
                        try:
                            from pypdf import PdfReader
                            reader = PdfReader(io.BytesIO(file_bytes))
                            pdf_text = "\n".join([page.extract_text() or "" for page in reader.pages]).strip()
                            if pdf_text:
                                attached_texts.append(f"--- Conteúdo do Documento Anexado: {name} (PDF) ---\n{pdf_text}")
                                logger.info(f"Extracted {len(pdf_text)} chars from attached PDF {name}")
                        except Exception as pe:
                            try:
                                decoded = file_bytes.decode("utf-8", errors="replace").strip()
                                if decoded:
                                    attached_texts.append(f"--- Conteúdo do Documento Anexado: {name} ---\n{decoded}")
                                    logger.info(f"Read {len(decoded)} chars from attached document {name} (text fallback)")
                            except Exception:
                                logger.warning(f"Could not extract text from attached PDF {name}: {pe}")
                    elif ext in ["txt", "md", "csv", "json", "py", "js", "ts", "html", "css", "yaml", "yml", "sql", "xml"] or att_type.startswith("text/"):
                        try:
                            decoded = file_bytes.decode("utf-8", errors="replace").strip()
                            if decoded:
                                attached_texts.append(f"--- Conteúdo do Arquivo de Texto Anexado: {name} ---\n{decoded}")
                                logger.info(f"Extracted {len(decoded)} chars from attached text file {name}")
                        except Exception as te:
                            logger.warning(f"Could not decode text attachment {name}: {te}")
                    else:
                        try:
                            decoded = file_bytes.decode("utf-8", errors="replace").strip()
                            if decoded:
                                attached_texts.append(f"--- Conteúdo do Arquivo Anexado: {name} ---\n{decoded}")
                                logger.info(f"Extracted {len(decoded)} chars from attached file {name} (general fallback)")
                        except Exception:
                            pass
                except Exception as ex:
                    logger.warning(f"Error reading attachment data for {name}: {ex}")

    # Enriquecimento com anexos da própria conversa (com prioridade máxima)
    if attached_texts:
        att_section = "\n\n".join(attached_texts)
        user_question = payload.content.strip() if payload.content and payload.content.strip() else "Por favor, analise as informações do documento anexado."
        ai_prompt_content = (
            f"[ARQUIVO(S) DIRETAMENTE ANEXADO(S) PELO USUÁRIO PARA ESTA CONSULTA]:\n"
            f"{att_section}\n\n"
            f"INSTRUÇÃO DE PRIORIDADE MÁXIMA: O usuário anexou explicitamente o(s) documento(s) acima para esta conversa. Dê preferência absoluta às informações contidas no(s) anexo(s) acima para responder e fundamentar a sua resposta com máxima precisão.\n\n"
            f"Pergunta do usuário:\n{user_question}"
        )

    # Busca Híbrida (pgvector + tsvector com RRF e Reranking) estritamente isolada por usuário e empresa
    chunks = []
    try:
        chunks = await hybrid_search(
            query=payload.content,
            company_id=company_id,
            user_id=user_id,
            top_k=4,
            threshold=0.25,
        )
    except Exception as rag_err:
        logger.warning(f"Erro ao executar busca híbrida no chat: {rag_err}")

    # Injeta contexto RAG dos documentos pertencentes a este usuário
    if chunks:
        doc_contexts = []
        for c in chunks:
            d_name = (c.get("metadata") or {}).get("document_name", "Documento")
            score_val = c.get("final_score") or c.get("similarity") or 0.0
            sim_pct = min(100, max(1, round(score_val * 100))) if score_val else 100
            doc_contexts.append(f"--- Documento Salvo pelo Usuário: {d_name} (Relevância: {sim_pct}%) ---\n{c['content']}")
        
        context_str = "\n\n".join(doc_contexts)
        ai_prompt_content = (
            f"Você tem acesso aos seguintes documentos salvos pelo usuário nos Documentos dele:\n\n"
            f"{context_str}\n\n"
            f"Utilize as informações dos documentos acima sempre que relevante para responder com precisão à pergunta do usuário.\n\n"
            f"{ai_prompt_content}"
        )
        logger.info(f"RAG: {len(chunks)} chunks de documentos do usuário {user_id} injetados na conversa {conv_id}.")

    # Prepara histórico completo para a IA (preservando anexos para processamento multimodal)
    history = [
        {
            "role": m["role"],
            "content": m["content"],
            "attachments": m.get("attachments", []),
        }
        for m in db.messages[conv_id]
    ]
    # Substitui a última mensagem com o prompt enriquecido e anexos atuais
    if history and history[-1]["role"] == "user":
        history[-1]["content"] = ai_prompt_content
        history[-1]["attachments"] = payload.attachments or []

    ai_model_id = conv.get("ai_model", "gemini-3.6-flash") if conv else "gemini-3.6-flash"

    # 2. Retorna SSE Stream
    async def sse_generator():
        assistant_chunks = []
        assistant_msg_id = ensure_uuid()

        try:
            async for chunk in stream_chat(ai_model_id, history):
                assistant_chunks.append(chunk)
                yield f"data: {json.dumps({'chunk': chunk})}\n\n"
        except asyncio.CancelledError:
            logger.info(f"Stream cancelled by client for conversation {conv_id}")
            full_content = "".join(assistant_chunks)
            interrupted_att = [{"type": "interrupted", "name": "cancelled"}]
            if is_valid_uuid(conv_id):
                try:
                    await create_message_in_supabase(
                        msg_id=assistant_msg_id,
                        conv_id=conv_id,
                        company_id=company_id,
                        role="assistant",
                        content=full_content,
                        attachments=interrupted_att,
                    )
                except Exception:
                    pass
            db.messages.setdefault(conv_id, []).append({
                "id": assistant_msg_id,
                "conversation_id": conv_id,
                "role": "assistant",
                "content": full_content,
                "attachments": interrupted_att,
                "created_at": datetime.now(timezone.utc),
                "is_interrupted": True,
            })
            return
        except Exception as e:
            err_msg = f"[Erro de processamento: {str(e)}]"
            assistant_chunks.append(err_msg)
            yield f"data: {json.dumps({'chunk': err_msg})}\n\n"

        # Salva mensagem do assistente no Supabase e em memória
        full_content = "".join(assistant_chunks)
        if is_valid_uuid(conv_id):
            await create_message_in_supabase(
                msg_id=assistant_msg_id,
                conv_id=conv_id,
                company_id=company_id,
                role="assistant",
                content=full_content,
                attachments=[],
            )

        assistant_msg = {
            "id": assistant_msg_id,
            "conversation_id": conv_id,
            "role": "assistant",
            "content": full_content,
            "attachments": [],
            "created_at": datetime.now(timezone.utc),
        }
        db.messages[conv_id].append(assistant_msg)
        yield f"data: {json.dumps({'done': True, 'message_id': assistant_msg_id})}\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
