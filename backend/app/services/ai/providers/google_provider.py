import asyncio
import base64
import logging
from typing import AsyncIterator, List, Dict, Any
from app.core.config import settings

logger = logging.getLogger("preci.google_provider")


async def stream_completion(messages: List[Dict[str, Any]], config: Dict[str, Any]) -> AsyncIterator[str]:
    api_key = settings.GOOGLE_API_KEY
    if api_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)
            contents = []
            for m in messages:
                role = "user" if m.get("role") == "user" else "model"
                parts = []

                if "parts" in m and m["parts"]:
                    parts = m["parts"]
                else:
                    # Se tiver anexos da mensagem
                    for att in m.get("attachments", []):
                        raw_b64 = att.get("data")
                        att_type = att.get("type", "")
                        att_name = att.get("name", "")
                        if not raw_b64 and att.get("url", "").startswith("data:"):
                            raw_b64 = att["url"].split(",")[1]

                        if raw_b64:
                            try:
                                file_bytes = base64.b64decode(raw_b64)
                                if att_type.startswith("image/"):
                                    mime = att_type if att_type else "image/jpeg"
                                    parts.append(types.Part.from_bytes(data=file_bytes, mime_type=mime))
                                    logger.info(f"Attached image {att_name} ({len(file_bytes)} bytes) to Gemini Content")
                                elif att_type == "application/pdf" or att_name.lower().endswith(".pdf"):
                                    parts.append(types.Part.from_bytes(data=file_bytes, mime_type="application/pdf"))
                                    logger.info(f"Attached PDF {att_name} ({len(file_bytes)} bytes) to Gemini Content")
                            except Exception as ex:
                                logger.warning(f"Error converting attachment {att_name} to genai Part: {ex}")

                    text_content = m.get("content", "")
                    if text_content or not parts:
                        parts.append(types.Part.from_text(text=text_content or " "))

                contents.append(
                    types.Content(
                        role=role,
                        parts=parts,
                    )
                )

            requested_model = config.get("api_model", "gemini-3.6-flash")
            candidate_models = [requested_model]

            for current_model in candidate_models:
                for attempt in range(2):
                    try:
                        def _get_stream(mod=current_model):
                            return client.models.generate_content_stream(
                                model=mod,
                                contents=contents,
                            )

                        stream = await asyncio.to_thread(_get_stream)
                        yielded_any = False
                        for chunk in stream:
                            if getattr(chunk, "text", None):
                                yielded_any = True
                                yield chunk.text
                        if yielded_any:
                            return
                    except Exception as e:
                        err_str = str(e)
                        is_quota_or_busy = (
                            "503" in err_str
                            or "429" in err_str
                            or "UNAVAILABLE" in err_str
                            or "RESOURCE_EXHAUSTED" in err_str
                            or "high demand" in err_str.lower()
                        )
                        logger.warning(
                            f"Google Gemini ({current_model}) attempt {attempt + 1}/2 error: {e}"
                        )
                        if is_quota_or_busy and attempt == 0:
                            await asyncio.sleep(1.2)
                            continue
                        break
        except Exception as e:
            logger.error(f"Google Gemini streaming exception: {e}", exc_info=True)

    # Mensagem amigável e segura caso a API da Google esteja temporariamente indisponível ou esgotada
    error_reply = (
        "⚠️ No momento, os servidores de IA estão com alta demanda temporária "
        "ou o limite de requisições foi atingido.\n\n"
        "💡 Por favor, aguarde alguns instantes e tente enviar sua mensagem novamente."
    )
    for word in error_reply.split(" "):
        await asyncio.sleep(0.02)
        yield word + " "

