"""Pydantic schemas for API request/response validation."""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


# ── Auth Schemas ──

class SignUpRequest(BaseModel):
    email: str = Field(..., description="User email")
    password: str = Field(..., min_length=6, description="Password (min 6 chars)")
    display_name: str | None = Field(None, description="Optional display name")

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user_id: str
    email: str

class ProfileResponse(BaseModel):
    id: str
    email: str | None = None
    display_name: str | None = None
    preferred_language: str = "en"

class ProfileUpdate(BaseModel):
    display_name: str | None = None
    preferred_language: str | None = None


# ── AI Config Schemas ──

class AIConfigCreate(BaseModel):
    provider: str = Field(..., description="'openai' or 'anthropic'")
    api_key: str = Field(..., description="API key (will be encrypted)")
    model_id: str = Field(..., description="e.g. 'gpt-4o', 'claude-sonnet-4-5-20250929'")

class AIConfigResponse(BaseModel):
    id: str
    provider: str
    model_id: str
    is_active: bool
    api_key_preview: str  # "sk-...abc" (masked)
    created_at: datetime | None = None


# ── Barcode Schemas ──

class BarcodeProduct(BaseModel):
    item_name: str
    brand: str | None = None
    category: str | None = None
    unit: str = "pcs"
    default_quantity: float | None = None
    image_url: str | None = None

class BarcodeResponse(BaseModel):
    found: bool
    barcode: str
    product: BarcodeProduct | None = None


# ── Photo Recognition Schemas ──

class RecognizedItem(BaseModel):
    item_name: str
    brand: str | None = None
    quantity: float = 1.0
    unit: str = "pcs"
    category: str | None = None
    confidence: str = "medium"

class PhotoRecognizeRequest(BaseModel):
    image_base64: str = Field(..., description="Base64-encoded image (with or without data URI prefix)")
    thread_id: str | None = Field(None, description="Thread ID for continuing conversation")


# ── Inventory Schemas ──

class InventoryItemCreate(BaseModel):
    item_name: str = Field(..., min_length=1, description="Normalized item name")
    brand: str | None = None
    quantity: float = Field(..., gt=0)
    total_volume: float = Field(..., gt=0)
    unit: str = Field(..., min_length=1)
    category: str | None = None
    expiry_date: date | None = None
    is_open: bool = False
    location: str = Field(..., min_length=1, description="Fridge, Freezer, or Pantry")

class InventoryItemResponse(BaseModel):
    id: int
    item_name: str
    brand: str | None
    quantity: float
    total_volume: float
    unit: str
    category: str | None
    expiry_date: date | None
    is_open: bool
    location: str
    created_at: datetime | None

class InventoryGroupResponse(BaseModel):
    item_name: str
    total_quantity: float
    unit: str
    batches: list[InventoryItemResponse]

class InventoryItemUpdate(BaseModel):
    quantity: float | None = None
    total_volume: float | None = None
    brand: str | None = None
    category: str | None = None
    expiry_date: date | None = None
    is_open: bool | None = None
    location: str | None = None


# ── Consumption Schemas ──

class ConsumeRequest(BaseModel):
    item_name: str = Field(..., description="Item to consume")
    amount: float = Field(..., gt=0, description="Amount to consume")
    brand: str | None = Field(None, description="Optional: specific brand")

class ConsumeResult(BaseModel):
    success: bool
    consumed_amount: float
    remaining_to_consume: float
    affected_batches: list[dict[str, Any]]
    message: str


# ── Transaction Log Schemas ──

class TransactionLogResponse(BaseModel):
    id: int
    intent: str
    raw_input: str | None
    ai_reasoning: str | None
    operation_details: dict[str, Any] | None
    created_at: datetime | None


# ── Agent Schemas ──

class AgentActionRequest(BaseModel):
    text: str = Field(default="", description="Natural language command")
    thread_id: str | None = Field(None, description="Thread ID for conversation continuity")
    confirm: bool | None = Field(None, description="Explicit confirmation")

class PendingActionItemResponse(BaseModel):
    index: int = 0
    intent: str | None = None
    extracted_info: dict[str, Any] | None = None
    missing_fields: list[str] | None = None

class PendingActionResponse(BaseModel):
    items: list[PendingActionItemResponse] | None = None
    confirmation_message: str | None = None

class AgentActionResponse(BaseModel):
    response: str = Field(..., description="Agent's response message")
    thread_id: str = Field(..., description="Thread ID for next request")
    status: str = Field(..., description="completed | awaiting_info | awaiting_confirm")
    pending_action: PendingActionResponse | None = None
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)


# ── Photo Recognition Response (after AgentActionResponse to avoid forward ref) ──

class PhotoRecognizeResponse(BaseModel):
    recognized_items: list[RecognizedItem]
    description: str
    agent_response: AgentActionResponse
