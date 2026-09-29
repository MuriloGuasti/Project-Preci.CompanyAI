from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Dict, Any
from app.core.security import decode_access_token
from app.core.config import settings
from app.db.supabase_client import db

security = HTTPBearer(auto_error=False)


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    if not credentials:
        # Development fallback: if no token provided, return default admin user for instant testing
        user = list(db.profiles.values())[0]
        return user

    payload = decode_access_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido ou expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    user = db.profiles.get(user_id)
    if not user:
        # Return synthesized user from token payload if not found in memory
        return {
            "id": user_id,
            "company_id": payload.get("company_id", "00000000-0000-0000-0000-000000000001"),
            "email": payload.get("email", settings.DEFAULT_ADMIN_EMAIL or "preci.contato@gmail.com"),
            "full_name": payload.get("full_name", "Administrador Preci"),
            "role": payload.get("role", "admin"),
            "theme_preference": "dark",
        }
    return user
