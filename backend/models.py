"""Pydantic models matching Supabase table schemas."""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel


class Profile(BaseModel):
    """Matches public.profiles table."""
    id: str
    display_name: str | None = None
    preferred_language: str = "en"
    created_at: datetime | None = None
    updated_at: datetime | None = None


class UserAIConfig(BaseModel):
    """Matches public.user_ai_configs table."""
    id: str | None = None
    user_id: str
    provider: str  # "openai" | "anthropic"
    api_key_secret_id: str  # vault.secrets.id
    model_id: str
    is_active: bool = False
    created_at: datetime | None = None


class InventoryItem(BaseModel):
    """Matches public.inventory table."""
    id: int | None = None
    user_id: str
    item_name: str
    brand: str | None = None
    quantity: float
    total_volume: float
    unit: str
    category: str | None = None
    expiry_date: date | None = None
    is_open: bool = False
    location: str
    created_at: datetime | None = None


class TransactionLog(BaseModel):
    """Matches public.transaction_logs table."""
    id: int | None = None
    user_id: str
    intent: str
    raw_input: str | None = None
    ai_reasoning: str | None = None
    operation_details: dict[str, Any] | None = None
    created_at: datetime | None = None
