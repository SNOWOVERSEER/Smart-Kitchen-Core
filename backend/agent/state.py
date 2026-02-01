"""State definitions for LangGraph agent."""

from typing import Annotated, Any, Literal
from typing_extensions import TypedDict

from langgraph.graph.message import add_messages


class PendingAction(TypedDict, total=False):
    """Represents a pending action awaiting confirmation or more info."""

    intent: Literal["ADD", "CONSUME", "DISCARD", "QUERY"]
    extracted_info: dict[str, Any]  # Info extracted from user input
    missing_fields: list[str]  # Required fields still missing
    needs_confirmation: bool  # Whether human confirmation is needed
    confirmation_message: str  # Message to show user for confirmation
    fefo_plan: list[dict[str, Any]]  # FEFO deduction plan for consume


class AgentState(TypedDict, total=False):
    """Main state for the agent graph."""

    messages: Annotated[list, add_messages]  # Conversation history
    pending_action: PendingAction | None  # Current pending action
    thread_id: str  # For multi-turn conversation tracking
    status: Literal["processing", "awaiting_info", "awaiting_confirm", "confirmed", "completed"]
    response: str  # Final response to user
    tool_calls: list[dict[str, Any]]  # Tool call history for debugging
    next: Literal["ask_more", "confirm", "execute", "end"] | None  # Routing hint


# Required fields per intent
REQUIRED_FIELDS = {
    "ADD": ["item_name", "quantity", "unit", "expiry_date"],
    "CONSUME": ["item_name", "amount"],
    "DISCARD": ["batch_id"],  # Or item_name + description
    "QUERY": [],  # No required fields
}

# Optional fields per intent
OPTIONAL_FIELDS = {
    "ADD": ["brand", "category", "location"],
    "CONSUME": ["brand", "unit"],
    "DISCARD": ["item_name", "reason"],
    "QUERY": ["item_name"],
}
