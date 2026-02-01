"""Pydantic schemas for API request/response validation."""

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field


#Inventory Schemas

class InventoryItemCreate(BaseModel):
    """Schema for adding a new inventory batch."""

    item_name: str = Field(..., min_length=1, description="Normalized item name")
    brand: str | None = None
    quantity: float = Field(..., gt=0)
    total_volume: float = Field(..., gt=0)
    unit: str = Field(..., min_length=1)
    category: str | None = None
    expiry_date: date | None = None
    is_open: bool = False
    location: str = "Pantry"


class InventoryItemResponse(BaseModel):
    """Schema for returning a single inventory batch."""

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
    created_at: datetime

    model_config = {"from_attributes": True}


class InventoryGroupResponse(BaseModel):
    """Schema for grouped inventory view (by item_name)."""

    item_name: str
    total_quantity: float
    unit: str
    batches: list[InventoryItemResponse]


#Consumption Schemas

class ConsumeRequest(BaseModel):
    """Schema for consuming inventory."""

    item_name: str = Field(..., description="Item to consume")
    amount: float = Field(..., gt=0, description="Amount to consume")
    brand: str | None = Field(None, description="Optional: specific brand to consume")


class ConsumeResult(BaseModel):
    """Schema for consumption operation result."""

    success: bool
    consumed_amount: float
    remaining_to_consume: float
    affected_batches: list[dict[str, Any]]
    message: str


#Transaction Log Schemas

class TransactionLogResponse(BaseModel):
    """Schema for returning transaction log entries."""

    id: int
    intent: str
    raw_input: str | None
    ai_reasoning: str | None
    operation_details: dict[str, Any] | None
    timestamp: datetime

    model_config = {"from_attributes": True}


#Agent Schemas

class AgentActionRequest(BaseModel):
    """Schema for agent action request."""

    text: str = Field(default="", description="Natural language command")
    thread_id: str | None = Field(None, description="Thread ID for conversation continuity")
    confirm: bool | None = Field(None, description="Explicit confirmation (True/False)")


class PendingActionResponse(BaseModel):
    """Schema for pending action details in response."""

    intent: str | None = None
    extracted_info: dict[str, Any] | None = None
    missing_fields: list[str] | None = None
    confirmation_message: str | None = None


class AgentActionResponse(BaseModel):
    """Schema for agent action response."""

    response: str = Field(..., description="Agent's response message")
    thread_id: str = Field(..., description="Thread ID for next request")
    status: str = Field(..., description="completed | awaiting_info | awaiting_confirm")
    pending_action: PendingActionResponse | None = Field(
        None, description="Pending action details for UI"
    )
    tool_calls: list[dict[str, Any]] = Field(
        default_factory=list,
        description="List of tools called during execution",
    )
