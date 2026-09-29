from typing import AsyncIterator, List, Dict, Any
from app.services.ai.models_config import MODELS
from app.services.ai.providers import google_provider

PROVIDERS = {
    "google": google_provider,
}


async def stream_chat(model_id: str, messages: List[Dict[str, Any]]) -> AsyncIterator[str]:
    config = MODELS.get(model_id, MODELS.get("gemini-3.6-flash", list(MODELS.values())[0]))
    provider = PROVIDERS.get(config["provider"], google_provider)
    async for chunk in provider.stream_completion(messages, config):
        yield chunk
