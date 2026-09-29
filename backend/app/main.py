import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.routes import auth, conversations, agents, documents, executions
from app.workers.scheduler_tick import start_in_memory_scheduler, stop_in_memory_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start in-memory scheduler tick (checks every 60s)
    start_in_memory_scheduler(interval_seconds=60)
    yield
    stop_in_memory_scheduler()


app = FastAPI(
    title="preci. API",
    description="Backend corporativo da suíte preci. com AI Streaming, Workflows estilo N8N e RAG.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits dev Vite client on localhost:5173
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(conversations.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(executions.router, prefix="/api/v1")


@app.get("/api/v1/health")
async def health_check():
    return {
        "status": "online",
        "service": "preci-backend",
        "version": "1.0.0",
        "env": settings.NODE_ENV,
    }


@app.get("/")
async def root():
    return {"message": "preci. API is running. Access /docs for interactive OpenAPI specification."}
