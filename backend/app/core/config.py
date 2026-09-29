import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from pydantic import BaseModel

# Procura o arquivo .env na raiz do projeto ou no diretório backend
_root_dir = Path(__file__).resolve().parents[3]
_root_env = _root_dir / ".env"
_backend_env = Path(__file__).resolve().parents[2] / ".env"

if _root_env.exists():
    load_dotenv(dotenv_path=_root_env, override=True)
if _backend_env.exists():
    load_dotenv(dotenv_path=_backend_env, override=True)


class Settings(BaseModel):
    NODE_ENV: str = os.getenv("NODE_ENV", "development")
    APP_URL: str = os.getenv("APP_URL", "http://localhost:5173")
    API_URL: str = os.getenv("API_URL", "http://localhost:8000")
    API_PORT: int = int(os.getenv("API_PORT", "8000"))

    SUPABASE_URL: Optional[str] = os.getenv("SUPABASE_URL", None)
    SUPABASE_ANON_KEY: Optional[str] = os.getenv("SUPABASE_ANON_KEY", None)
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = os.getenv("SUPABASE_SERVICE_ROLE_KEY", None)
    SUPABASE_JWT_SECRET: Optional[str] = os.getenv("SUPABASE_JWT_SECRET", None)

    SUPABASE_STORAGE_BUCKET_DOCUMENTS: str = os.getenv("SUPABASE_STORAGE_BUCKET_DOCUMENTS", "documents")
    SUPABASE_STORAGE_BUCKET_AVATARS: str = os.getenv("SUPABASE_STORAGE_BUCKET_AVATARS", "avatars")

    OPENAI_API_KEY: Optional[str] = os.getenv("OPENAI_API_KEY", None)
    ANTHROPIC_API_KEY: Optional[str] = os.getenv("ANTHROPIC_API_KEY", None)
    GOOGLE_API_KEY: Optional[str] = os.getenv("GOOGLE_API_KEY", None)

    EMBEDDINGS_PROVIDER: str = os.getenv("EMBEDDINGS_PROVIDER", "openai")
    EMBEDDINGS_MODEL: str = os.getenv("EMBEDDINGS_MODEL", "text-embedding-3-small")

    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")

    JWT_SECRET: str = os.getenv("JWT_SECRET", "preci-development-secret-key-change-in-production")
    COOKIE_SECRET: str = os.getenv("COOKIE_SECRET", "preci-cookie-secret-key")
    CORS_ORIGIN: str = os.getenv("CORS_ORIGIN", "http://localhost:5173")

    DEFAULT_ADMIN_EMAIL: str = os.getenv("DEFAULT_ADMIN_EMAIL", "admin@preci.local")
    DEFAULT_ADMIN_PASSWORD: str = os.getenv("DEFAULT_ADMIN_PASSWORD", "admin")


settings = Settings()
