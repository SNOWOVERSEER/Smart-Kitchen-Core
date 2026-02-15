"""Multi-provider LLM factory. Returns configured LLM based on user settings."""

from langchain_core.language_models import BaseChatModel
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic

from config import DEFAULT_OPENAI_API_KEY
from database import get_supabase_client


def get_user_llm(user_id: str) -> BaseChatModel:
    """
    Get configured LLM for a specific user.

    Reads user's active AI config from user_ai_configs table.
    Falls back to server default OpenAI key if no user config exists.
    """
    supabase = get_supabase_client()

    # Get user's active AI config
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
        # Decrypt API key from Vault
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

    # Fallback to server default
    if DEFAULT_OPENAI_API_KEY:
        return ChatOpenAI(
            api_key=DEFAULT_OPENAI_API_KEY,
            model="gpt-4o",
            temperature=0,
        )

    raise ValueError("No AI provider configured. Please add an API key in settings.")
