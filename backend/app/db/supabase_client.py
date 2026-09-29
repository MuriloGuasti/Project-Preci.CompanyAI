import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from app.core.config import settings

# In-memory mock store for local development & testing when Supabase credentials are not provided
class LocalMockDB:
    def __init__(self):
        self.companies: Dict[str, Dict[str, Any]] = {
            "00000000-0000-0000-0000-000000000001": {
                "id": "00000000-0000-0000-0000-000000000001",
                "name": "Empresa Teste",
                "slug": "empresa-teste",
            },
            "00000000-0000-0000-0000-000000000002": {
                "id": "00000000-0000-0000-0000-000000000002",
                "name": "Empresa Parceira 2",
                "slug": "empresa-parceira-2",
            },
        }
        self.profiles: Dict[str, Dict[str, Any]] = {
            "8f2646a2-3dce-4efa-9451-34ff0924f58b": {
                "id": "8f2646a2-3dce-4efa-9451-34ff0924f58b",
                "company_id": "00000000-0000-0000-0000-000000000001",
                "full_name": "Administrador Preci",
                "email": settings.DEFAULT_ADMIN_EMAIL or "preci.contato@gmail.com",
                "role": "admin",
                "theme_preference": "dark",
            },
            "fb7ca2d4-2863-4ef4-9c11-62d13f4e5761": {
                "id": "fb7ca2d4-2863-4ef4-9c11-62d13f4e5761",
                "company_id": "00000000-0000-0000-0000-000000000001",
                "full_name": "Usuário Teste (Colaborador)",
                "email": "user@preci.local",
                "role": "member",
                "theme_preference": "dark",
            },
            "c2222222-2222-2222-2222-222222222222": {
                "id": "c2222222-2222-2222-2222-222222222222",
                "company_id": "00000000-0000-0000-0000-000000000002",
                "full_name": "Gestor Empresa 2",
                "email": "empresa2@preci.local",
                "role": "admin",
                "theme_preference": "dark",
            },
        }
        self.conversations: Dict[str, Dict[str, Any]] = {}
        self.messages: Dict[str, List[Dict[str, Any]]] = {}
        self.agents: Dict[str, Dict[str, Any]] = {}
        self.document_folders: Dict[str, Dict[str, Any]] = {}
        self.documents: Dict[str, Dict[str, Any]] = {}
        self.document_chunks: Dict[str, Dict[str, Any]] = {}
        self.agent_schedules: Dict[str, Dict[str, Any]] = {}
        self.agent_executions: Dict[str, Dict[str, Any]] = {}

db = LocalMockDB()
