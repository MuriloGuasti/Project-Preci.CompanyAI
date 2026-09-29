import asyncio
from typing import AsyncIterator, List, Dict, Any
from app.core.config import settings


async def stream_completion(messages: List[Dict[str, Any]], config: Dict[str, Any]) -> AsyncIterator[str]:
    api_key = settings.OPENAI_API_KEY
    if api_key:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=api_key)
            formatted = [{"role": m["role"], "content": m["content"]} for m in messages]
            response = await client.chat.completions.create(
                model=config.get("api_model", "gpt-4o"),
                messages=formatted,
                stream=True,
                max_tokens=config.get("max_tokens", 4096),
            )
            async for chunk in response:
                delta = chunk.choices[0].delta.content
                if delta:
                    yield delta
            return
        except Exception as e:
            yield f"[OpenAI Error: {str(e)}]\n"

    # Intelligent Mock Response for Offline/Development
    last_msg = messages[-1]["content"] if messages else ""
    mock_reply = (
        f"Compreendi perfeitamente sua solicitação sobre: '{last_msg}'.\n\n"
        "Como modelo de inteligência artificial da plataforma **preci.**, posso auxiliá-lo com:\n"
        "- Análise e síntese de documentos contratuais;\n"
        "- Execução de fluxos automatizados entre departamentos;\n"
        "- Extração precisa de entidades e insights para decisões estratégicas.\n\n"
        "Como deseja proceder nesta etapa?"
    )
    for word in mock_reply.split(" "):
        await asyncio.sleep(0.04)
        yield word + " "
