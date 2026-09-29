import asyncio
import hashlib
import logging
import time
from typing import List, Dict
from app.core.config import settings

logger = logging.getLogger("preci.embeddings")

# Cache em memória para evitar chamadas duplicadas e poupar TPM
_EMBEDDING_CACHE: Dict[str, List[float]] = {}
_MAX_CACHE_SIZE = 1000

# Rate limiter global para embeddings (evita estourar o limite de 30K TPM da Google)
_call_lock = asyncio.Lock()
_last_call_time = 0.0
# 600ms de espaçamento mínimo entre chamadas = máx ~100 chamadas/min (bem seguro para 30K TPM)
MIN_EMBEDDING_INTERVAL_SECONDS = 0.6


async def _rate_limit() -> None:
    global _last_call_time
    async with _call_lock:
        now = time.monotonic()
        elapsed = now - _last_call_time
        if elapsed < MIN_EMBEDDING_INTERVAL_SECONDS:
            sleep_time = MIN_EMBEDDING_INTERVAL_SECONDS - elapsed
            await asyncio.sleep(sleep_time)
        _last_call_time = time.monotonic()


async def generate_embedding(text: str) -> List[float]:
    if not text or not text.strip():
        return [0.0] * 1536

    clean_text = text.strip()
    cache_key = hashlib.sha256(clean_text.encode("utf-8")).hexdigest()
    if cache_key in _EMBEDDING_CACHE:
        return _EMBEDDING_CACHE[cache_key]

    if settings.GOOGLE_API_KEY:
        # Tenta com Google Gemini respeitando espaçamento (delay) e retentativa em caso de 429/503
        for attempt in range(3):
            try:
                await _rate_limit()
                from google import genai
                from google.genai import types

                client = genai.Client(api_key=settings.GOOGLE_API_KEY)

                def _embed():
                    return client.models.embed_content(
                        model=settings.EMBEDDINGS_MODEL or "gemini-embedding-2",
                        contents=clean_text,
                        config=types.EmbedContentConfig(output_dimensionality=1536),
                    )

                res = await asyncio.to_thread(_embed)
                vec = None
                if hasattr(res, "embedding") and res.embedding and res.embedding.values:
                    vec = list(res.embedding.values)
                elif hasattr(res, "embeddings") and res.embeddings and res.embeddings[0].values:
                    vec = list(res.embeddings[0].values)

                if vec:
                    if len(_EMBEDDING_CACHE) >= _MAX_CACHE_SIZE:
                        _EMBEDDING_CACHE.pop(next(iter(_EMBEDDING_CACHE)))
                    _EMBEDDING_CACHE[cache_key] = vec
                    return vec
            except Exception as e:
                err_str = str(e)
                if ("429" in err_str or "503" in err_str or "RESOURCE_EXHAUSTED" in err_str or "UNAVAILABLE" in err_str) and attempt < 2:
                    wait_s = 1.5 * (attempt + 1)
                    logger.warning(f"Google Gemini Embedding rate limit atingido (tentativa {attempt + 1}/3). Aguardando {wait_s}s...")
                    await asyncio.sleep(wait_s)
                    continue
                logger.error(f"Error generating Google Gemini embedding: {e}")
                break

    if settings.OPENAI_API_KEY:
        try:
            await _rate_limit()
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
            resp = await client.embeddings.create(
                input=[clean_text],
                model=settings.EMBEDDINGS_MODEL or "text-embedding-3-small",
            )
            vec = resp.data[0].embedding
            if vec:
                _EMBEDDING_CACHE[cache_key] = vec
                return vec
        except Exception as e:
            logger.error(f"Error generating OpenAI embedding: {e}")

    # Fallback determinístico para 1536 dimensões compatível com pgvector
    h = hashlib.sha256(clean_text.encode("utf-8")).digest()
    vec = [(float(b) / 255.0) * 2 - 1 for b in h]
    multiplier = (1536 // len(vec)) + 1
    fallback_vec = (vec * multiplier)[:1536]
    _EMBEDDING_CACHE[cache_key] = fallback_vec
    return fallback_vec

