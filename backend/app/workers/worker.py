from typing import Any, Dict
from arq import cron
from app.core.config import settings
from app.services.rag.chunking import chunk_text
from app.services.rag.embeddings import generate_embedding
from app.services.agents.executor import execute_agent_workflow
from app.workers.scheduler_tick import scheduler_tick


async def process_document_embedding(ctx: Dict[str, Any], doc_id: str, content: str) -> None:
    chunks = chunk_text(content)
    for c in chunks:
        _ = await generate_embedding(c["content"])
    # Document marked ready in DB


async def process_agent_workflow(ctx: Dict[str, Any], agent_data: Dict[str, Any]) -> Dict[str, Any]:
    return await execute_agent_workflow(agent_data)


class WorkerSettings:
    functions = [process_document_embedding, process_agent_workflow, scheduler_tick]
    cron_jobs = [cron(scheduler_tick, minute=set(range(60)))]
    redis_settings = settings.REDIS_URL
