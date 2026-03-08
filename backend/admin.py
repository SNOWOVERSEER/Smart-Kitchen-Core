"""Admin service: user management, usage stats, voucher CRUD."""

from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException

from auth import get_current_user
from database import get_supabase_admin_client
from config import ADMIN_EMAILS


def get_admin_user(user_id: str = Depends(get_current_user)) -> str:
    """Dependency: verify user is admin by email."""
    supabase = get_supabase_admin_client()
    user = supabase.auth.admin.get_user_by_id(user_id)
    if not user or user.user.email not in ADMIN_EMAILS:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user_id


def list_subscriptions(page: int = 0, limit: int = 50) -> list[dict]:
    """List all subscriptions with user info."""
    supabase = get_supabase_admin_client()
    result = (
        supabase.table("subscriptions")
        .select("*")
        .order("created_at", desc=True)
        .range(page * limit, (page + 1) * limit - 1)
        .execute()
    )
    subs = result.data or []
    for sub in subs:
        try:
            user = supabase.auth.admin.get_user_by_id(sub["user_id"])
            sub["email"] = user.user.email if user else None
        except Exception:
            sub["email"] = None
        try:
            profile = supabase.table("profiles").select("display_name").eq("id", sub["user_id"]).maybe_single().execute()
            sub["display_name"] = profile.data.get("display_name") if profile.data else None
        except Exception:
            sub["display_name"] = None
    return subs


def update_user_credits(user_id: str, prompt_credits: int | None, bonus_credits: int | None) -> dict:
    """Update credits for a user."""
    supabase = get_supabase_admin_client()
    updates: dict = {}
    if prompt_credits is not None:
        updates["prompt_credits"] = prompt_credits
    if bonus_credits is not None:
        updates["bonus_credits"] = bonus_credits
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    result = supabase.table("subscriptions").update(updates).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Subscription not found")
    return result.data[0]


def get_usage_stats(days: int = 30) -> list[dict]:
    """Get daily usage stats aggregated by action."""
    supabase = get_supabase_admin_client()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    result = (
        supabase.table("usage_logs")
        .select("action, created_at, tier_at_time")
        .gte("created_at", since)
        .order("created_at", desc=True)
        .limit(5000)
        .execute()
    )
    stats: dict[str, dict[str, int]] = {}
    for log in result.data or []:
        date = log["created_at"][:10]
        action = log.get("action", "unknown")
        if date not in stats:
            stats[date] = {}
        stats[date][action] = stats[date].get(action, 0) + 1

    return [{"date": d, **actions} for d, actions in sorted(stats.items(), reverse=True)]


def list_vouchers() -> list[dict]:
    """List all vouchers."""
    supabase = get_supabase_admin_client()
    result = supabase.table("vouchers").select("*").order("created_at", desc=True).execute()
    return result.data or []


def create_voucher(code: str, v_type: str, value: int, max_uses: int | None, expires_at: str | None) -> dict:
    """Create a new voucher."""
    supabase = get_supabase_admin_client()
    data: dict = {"code": code, "type": v_type, "value": value, "used_count": 0}
    if max_uses is not None:
        data["max_uses"] = max_uses
    if expires_at:
        data["expires_at"] = expires_at
    result = supabase.table("vouchers").insert(data).execute()
    return result.data[0]


def delete_voucher(voucher_id: int) -> None:
    """Delete a voucher."""
    supabase = get_supabase_admin_client()
    supabase.table("vouchers").delete().eq("id", voucher_id).execute()
