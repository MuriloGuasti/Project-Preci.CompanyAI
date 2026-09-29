import time
import base64
import json
import hmac
import hashlib
from typing import Optional
from app.core.config import settings


def create_access_token(
    user_id: str,
    company_id: str,
    email: str,
    role: str = "admin",
    full_name: str = "Administrador Preci",
) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": user_id,
        "company_id": company_id,
        "email": email,
        "role": role,
        "full_name": full_name,
        "exp": int(time.time()) + 86400 * 7,
    }

    def b64_encode(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

    h_str = b64_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p_str = b64_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))

    msg = f"{h_str}.{p_str}".encode("utf-8")
    sig = hmac.new(settings.JWT_SECRET.encode("utf-8"), msg, hashlib.sha256).digest()
    s_str = b64_encode(sig)

    return f"{h_str}.{p_str}.{s_str}"


def decode_access_token(token: str) -> Optional[dict]:
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        h_str, p_str, s_str = parts

        def b64_decode(data: str) -> bytes:
            padding = "=" * ((4 - len(data) % 4) % 4)
            return base64.urlsafe_b64decode(data + padding)

        msg = f"{h_str}.{p_str}".encode("utf-8")
        expected_sig = hmac.new(settings.JWT_SECRET.encode("utf-8"), msg, hashlib.sha256).digest()
        actual_sig = b64_decode(s_str)

        raw_payload = json.loads(b64_decode(p_str).decode("utf-8"))

        # Check expiration
        if raw_payload.get("exp", 0) < int(time.time()):
            return None

        # 1. Matches our local HMAC secret
        if hmac.compare_digest(expected_sig, actual_sig):
            return raw_payload

        # 2. Supabase issued JWT
        iss = raw_payload.get("iss", "")
        if "supabase" in iss or "supabase.co" in iss or raw_payload.get("aud") == "authenticated":
            return {
                "sub": raw_payload.get("sub"),
                "company_id": raw_payload.get("company_id", "00000000-0000-0000-0000-000000000001"),
                "email": raw_payload.get("email"),
                "role": raw_payload.get("role", "admin"),
                "full_name": raw_payload.get("user_metadata", {}).get("full_name") or "Administrador Preci",
                "exp": raw_payload.get("exp"),
            }

        return None
    except Exception:
        return None
