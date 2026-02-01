from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSON
from sqlmodel import Field, SQLModel


class InventoryItem(SQLModel, table=True):
    """
    Represents a single batch of inventory.
    Each physical item/package is a separate row, enabling FEFO tracking.
    """

    __tablename__ = "inventory"

    id: int | None = Field(default=None, primary_key=True)
    item_name: str = Field(index=True)  # Normalized name (e.g., "Milk")
    brand: str | None = None  # Distinguishes "A2" from "Coles"
    quantity: float  # Current remaining amount (e.g., 0.5)
    total_volume: float  # Original package size (e.g., 1.0) for UI progress bars
    unit: str  # "L", "kg", "pcs"
    category: str | None = None  # Meat, Veg, Dairy, Pantry
    expiry_date: date | None = None  # Critical for FEFO sorting
    is_open: bool = Field(default=False)  # Priority for consumption
    location: str = Field(default="Fridge")  # Fridge, Freezer, Pantry
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )


class TransactionLog(SQLModel, table=True):
    """
    Audit trail for all inventory operations.
    Records AI reasoning for debugging and transparency.
    """

    __tablename__ = "transaction_logs"

    id: int | None = Field(default=None, primary_key=True)
    intent: str  # "INBOUND_SCAN", "CONSUME", "DISCARD"
    raw_input: str | None = None  # User's natural language input
    ai_reasoning: str | None = None  # Chain of Thought explanation
    operation_details: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSON)
    )  # e.g., {"deducted_from_batch_id": 101, "amount": 0.5}
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
