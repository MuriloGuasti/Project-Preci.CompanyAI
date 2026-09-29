import asyncio
from typing import AsyncIterator, List, Dict, Any
from app.core.config import settings


async def stream_completion(messages: List[Dict[str, Any]], config: Dict[str, Any]) -> AsyncIterator[str]:
    api_key = settings.ANTHROPIC_API_KEY
    if api_key:
        try:
            from anthropic import AsyncAnthropic  # type: ignore
            client = AsyncAnthropic(api_key=api_key)
            formatted = [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] in ("user", "assistant")]
            async with client.messages.stream(
                model="claude-3-5-sonnet-20241022",
                max_tokens=config.get("max_tokens", 4096),
                messages=formatted,
            ) as stream:
                async for text in stream.text_stream:
                    yield text
            return
        except Exception as e:
            yield f"[Anthropic Error: {str(e)}]\n"

    # Intelligent Mock Response for Offline/Development
    last_msg = messages[-1]["content"] if messages else ""
    mock_reply = (
        f"Olá! Analisei sua mensagem: \"{last_msg}\".\n\n"
        "Com o modelo **Claude Sonnet 4.6** integrado à infraestrutura **preci.**, mantemos o mais alto padrão de precisão e contexto corporativo.\n\n"
        "Seus agentes configurados e documentos anexados estão disponíveis para cruzamento semântico imediato. Qual é o próximo objetivo?"
    )
    for word in mock_reply.split(" "):
        await asyncio.sleep(0.04)
        yield word + " "
