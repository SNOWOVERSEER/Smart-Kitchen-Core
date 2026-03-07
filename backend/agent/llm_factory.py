"""Multi-provider LLM factory. Returns configured LLM based on user settings.

LLM instances are cached per user_id with a 5-minute TTL to avoid
repeated DB + Vault lookups on every agent turn.
"""

import time
import threading
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

from config import DEFAULT_OPENAI_API_KEY
from database import get_supabase_client

# Cache: { user_id: (llm_instance, expiry_timestamp) }
_llm_cache: dict[str, tuple[BaseChatModel, float]] = {}
_cache_lock = threading.Lock()
_CACHE_TTL = 300  # 5 minutes


def _build_llm(user_id: str) -> BaseChatModel:
    """Build LLM instance from user's active AI config (uncached)."""
    supabase = get_supabase_client()

    result = (
        supabase.table("user_ai_configs")
        .select("provider, api_key_secret_id, model_id")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )

    if result.data:
        config = result.data[0]
        secret_result = supabase.rpc(
            "get_decrypted_secret",
            {"secret_id": config["api_key_secret_id"]},
        ).execute()
        api_key = secret_result.data

        if config["provider"] == "openai":
            return ChatOpenAI(
                api_key=api_key,
                model=config["model_id"],
                temperature=0,
            )
        elif config["provider"] == "anthropic":
            return ChatAnthropic(
                api_key=api_key,
                model=config["model_id"],
                temperature=0,
            )
        elif config["provider"] == "minimax":
            return ChatAnthropic(
                api_key=api_key,
                anthropic_api_url="https://api.minimax.io/anthropic",
                model=config["model_id"],
                temperature=0,
            )
        elif config["provider"] == "minimax_cn":
            return ChatAnthropic(
                api_key=api_key,
                anthropic_api_url="https://api.minimaxi.com/anthropic",
                model=config["model_id"],
                temperature=0,
            )

    # Fallback to server default
    if DEFAULT_OPENAI_API_KEY:
        return ChatOpenAI(
            api_key=DEFAULT_OPENAI_API_KEY,
            model="gpt-4o",
            temperature=0,
        )

    raise ValueError("No AI provider configured. Please add an API key in settings.")


def get_user_llm(user_id: str) -> BaseChatModel:
    """
    Get configured LLM for a specific user (cached with 5-min TTL).

    Reads user's active AI config from user_ai_configs table.
    Falls back to server default OpenAI key if no user config exists.
    """
    now = time.monotonic()

    with _cache_lock:
        cached = _llm_cache.get(user_id)
        if cached and cached[1] > now:
            return cached[0]

    # Build outside lock to avoid holding it during DB calls
    llm = _build_llm(user_id)

    with _cache_lock:
        _llm_cache[user_id] = (llm, now + _CACHE_TTL)

    return llm


def invalidate_llm_cache(user_id: str) -> None:
    """Clear cached LLM for a user (call when AI settings change)."""
    with _cache_lock:
        _llm_cache.pop(user_id, None)
