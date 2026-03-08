"""Quota management: check credits and deduct on AI calls."""

from datetime import datetime, timezone
from dataclasses import dataclass

from fastapi import Depends, HTTPException

from auth import get_current_user
from database import get_supabase_admin_client


@dataclass
class QuotaContext:
    """Result of quota check, passed to endpoint handlers."""
    user_id: str
    tier: str          # "free" | "supporter" | "byok"
    deducted: bool     # whether a credit was deducted
    use_platform_key: bool  # whether to use platform LLM key


def _has_active_api_key(supabase, user_id: str) -> bool:
    """Check if user has a BYOK API key configured."""
    result = (
        supabase.table("user_ai_configs")
        .select("id")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    return bool(result.data)


def _get_subscription(supabase, user_id: str) -> dict:
    """Get or create user subscription row."""
    result = (
        supabase.table("subscriptions")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if result.data:
        return result.data[0]

    # Auto-create if missing (edge case: user created before migration)
    supabase.table("subscriptions").insert({
        "user_id": user_id,
        "tier": "free",
        "prompt_credits": 20,
        "bonus_credits": 0,
    }).execute()
    return _get_subscription(supabase, user_id)


def _lazy_expire_trial(supabase, sub: dict) -> dict:
    """If trial has expired, clear prompt_credits and trial_ends_at."""
    trial_ends = sub.get("trial_ends_at")
    if not trial_ends:
        return sub

    if isinstance(trial_ends, str):
        trial_ends = datetime.fromisoformat(trial_ends.replace("Z", "+00:00"))

    if trial_ends < datetime.now(timezone.utc):
        supabase.table("subscriptions").update({
            "prompt_credits": 0,
            "trial_ends_at": None,
        }).eq("id", sub["id"]).execute()
        sub["prompt_credits"] = 0
        sub["trial_ends_at"] = None
    return sub


def _log_usage(supabase, user_id: str, action: str, tier: str, credited: bool) -> None:
    """Write a usage log entry."""
    supabase.table("usage_logs").insert({
        "user_id": user_id,
        "action": action,
        "tier_at_time": tier,
        "credited": credited,
    }).execute()


def _deduct_credit_atomic(supabase, user_id: str) -> str:
    """Atomically deduct 1 credit. Returns 'prompt' or 'bonus'."""
    # Use direct SQL via Supabase's raw RPC to avoid PostgREST schema cache issues
    sub = (
        supabase.table("subscriptions")
        .select("id, prompt_credits, bonus_credits")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    if not sub.data:
        raise HTTPException(status_code=403, detail="no_credits")

    row = sub.data[0]
    sub_id = row["id"]
    prompt = row["prompt_credits"]
    bonus = row["bonus_credits"]

    if prompt > 0:
        # Deduct from prompt_credits, use gt filter for optimistic concurrency
        result = (
            supabase.table("subscriptions")
            .update({"prompt_credits": prompt - 1})
            .eq("id", sub_id)
            .gt("prompt_credits", 0)
            .execute()
        )
        if result.data:
            return "prompt"
        # Retry: someone else may have deducted, re-read
        return _deduct_credit_atomic(supabase, user_id)
    elif bonus > 0:
        result = (
            supabase.table("subscriptions")
            .update({"bonus_credits": bonus - 1})
            .eq("id", sub_id)
            .gt("bonus_credits", 0)
            .execute()
        )
        if result.data:
            return "bonus"
        return _deduct_credit_atomic(supabase, user_id)
    else:
        raise HTTPException(status_code=403, detail="no_credits")


def check_and_deduct_credit(
    user_id: str = Depends(get_current_user),
) -> QuotaContext:
    """
    FastAPI dependency: check user's tier and deduct 1 credit if needed.

    - BYOK users: pass through, no deduction
    - Free/Supporter: atomically deduct from prompt_credits first, then bonus_credits
    - No credits left: raise 403
    """
    supabase = get_supabase_admin_client()

    # 1. Check BYOK
    if _has_active_api_key(supabase, user_id):
        _log_usage(supabase, user_id, "ai_call", "byok", credited=False)
        return QuotaContext(
            user_id=user_id,
            tier="byok",
            deducted=False,
            use_platform_key=False,
        )

    # 2. Get subscription + lazy trial expiry
    sub = _get_subscription(supabase, user_id)
    sub = _lazy_expire_trial(supabase, sub)
    tier = sub["tier"]

    # 3. Atomically deduct 1 credit (prompt first, then bonus)
    pool = _deduct_credit_atomic(supabase, user_id)
    _log_usage(supabase, user_id, "ai_call", tier, credited=True)
    return QuotaContext(
        user_id=user_id,
        tier=tier,
        deducted=True,
        use_platform_key=True,
    )


def check_credit_skip_confirm(
    user_id: str = Depends(get_current_user),
) -> QuotaContext:
    """
    Variant for agent endpoints: checks credit availability but does NOT deduct.
    The endpoint itself calls deduct_credit() only for new messages (not confirm/cancel).
    """
    supabase = get_supabase_admin_client()

    if _has_active_api_key(supabase, user_id):
        return QuotaContext(
            user_id=user_id,
            tier="byok",
            deducted=False,
            use_platform_key=False,
        )

    sub = _get_subscription(supabase, user_id)
    sub = _lazy_expire_trial(supabase, sub)
    tier = sub["tier"]
    total = sub["prompt_credits"] + sub["bonus_credits"]

    if total <= 0:
        raise HTTPException(status_code=403, detail="no_credits")

    return QuotaContext(
        user_id=user_id,
        tier=tier,
        deducted=False,
        use_platform_key=True,
    )


def deduct_credit(user_id: str, action: str = "ai_call") -> None:
    """Explicitly deduct 1 credit. Called after confirming this is a real AI call."""
    supabase = get_supabase_admin_client()
    sub = _get_subscription(supabase, user_id)
    tier = sub["tier"]

    _deduct_credit_atomic(supabase, user_id)
    _log_usage(supabase, user_id, action, tier, credited=True)
