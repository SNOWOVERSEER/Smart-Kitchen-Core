"""Authentication middleware using Supabase Auth."""

from fastapi import HTTPException, Header

from database import get_supabase_anon_client, set_current_token


async def get_current_user(authorization: str = Header(...)) -> str:
    """
    FastAPI dependency: validates JWT and returns user_id.

    Extracts Bearer token from Authorization header,
    verifies with Supabase Auth, returns user UUID.
    Also stores the token in context for downstream Supabase calls.

    Raises:
        HTTPException 401 if token is invalid or expired.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")

    token = authorization.removeprefix("Bearer ")

    try:
        supabase = get_supabase_anon_client()
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")

        # Store token so get_supabase_client() creates user-authenticated clients
        set_current_token(token)

        return user_response.user.id
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
