"""State definitions for LangGraph agent."""

from typing import Annotated, Any, Literal
from typing_extensions import TypedDict

from langgraph.graph.message import add_messages


class PendingActionItem(TypedDict, total=False):
    """Single item within a multi-item operation."""

    index: int  # Position in the list (for tracking)
    intent: Literal["ADD", "CONSUME", "DISCARD", "QUERY"]
    extracted_info: dict[str, Any]  # Info extracted for this item
    missing_fields: list[str]  # Required fields still missing for this item
    fefo_plan: list[dict[str, Any]]  # FEFO deduction plan (for CONSUME)


class PendingAction(TypedDict, total=False):
    """Container for one or more pending actions (multi-item support)."""

    items: list[PendingActionItem]  # List of pending items
    needs_confirmation: bool  # Whether human confirmation is needed
    confirmation_message: str  # Message to show user for confirmation
    all_complete: bool  # True when all items have required info


class AgentState(TypedDict, total=False):
    """Main state for the agent graph."""

    messages: Annotated[list, add_messages]  # Conversation history
    pending_action: PendingAction | None  # Current pending action
    thread_id: str  # For multi-turn conversation tracking
    user_id: str  # Scopes all DB operations to this user
    status: Literal["processing", "awaiting_info", "awaiting_confirm", "confirmed", "completed"]
    response: str  # Final response to user
    tool_calls: list[dict[str, Any]]  # Tool call history for debugging
    next: Literal["ask_more", "confirm", "execute", "end"] | None  # Routing hint


# Required fields per intent
REQUIRED_FIELDS = {
    "ADD": ["item_name", "quantity", "unit", "expiry_date", "location"],  # location now required
    "CONSUME": ["item_name", "amount"],
    "DISCARD": ["batch_id"],  # Or item_name + description
    "QUERY": [],  # No required fields
}

# Optional fields per intent
OPTIONAL_FIELDS = {
    "ADD": ["brand", "category"],  # location removed from optional
    "CONSUME": ["brand", "unit"],
    "DISCARD": ["item_name", "reason"],
    "QUERY": ["item_name"],
}
