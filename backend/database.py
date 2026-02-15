"""Supabase client initialization with per-request user authentication."""

import contextvars

from supabase import create_client, Client

from config import SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY

# Context variable to store the current user's JWT per-request.
# FastAPI runs each request in its own async context, so this is safe.
_current_access_token: contextvars.ContextVar[str | None] = contextvars.ContextVar(
    "access_token", default=None
)


def set_current_token(token: str) -> None:
    """Store the current user's JWT for downstream Supabase calls."""
    _current_access_token.set(token)


def get_supabase_client() -> Client:
    """Get Supabase client for server-side operations.

    Priority:
    1. If a user JWT is set (via auth middleware), creates a client
       authenticated as that user. RLS policies apply.
    2. If SUPABASE_SECRET_KEY is configured, uses secret key
       (bypasses RLS). Used for admin operations.
    3. Falls back to publishable key.
    """
    token = _current_access_token.get()
    if token:
        # User-authenticated client: publishable key + user JWT
        # PostgREST uses the JWT for RLS evaluation
        client = create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
        client.postgrest.auth(token)
        return client

    if SUPABASE_SECRET_KEY:
        return create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)

    return create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)


def get_supabase_anon_client() -> Client:
    """Get Supabase client with publishable key (for auth operations)."""
    return create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
