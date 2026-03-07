"""Rate limiting configuration using slowapi."""

from slowapi import Limiter
from slowapi.util import get_remote_address
from starlette.requests import Request


def _get_user_id_or_ip(request: Request) -> str:
    """Extract user_id from auth header for rate limiting key, fall back to IP."""
    auth_header = request.headers.get("authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
        if token:
            return f"user:{hash(token) & 0xFFFFFFFF:08x}"
    return get_remote_address(request)


def _get_ip(request: Request) -> str:
    """Always use IP for unauthenticated endpoints (login/signup)."""
    return get_remote_address(request)


limiter = Limiter(
    key_func=_get_user_id_or_ip,
    default_limits=["60/minute"],
    storage_uri="memory://",
    headers_enabled=True,
)

# Rate limit strings for decorators
AI_RATE_LIMIT = "10/minute"
AUTH_RATE_LIMIT = "5/minute"
