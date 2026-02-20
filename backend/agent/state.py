"""State definitions for the tool-calling LangGraph agent."""

from typing import Annotated, Any, Literal
from typing_extensions import TypedDict

from langgraph.graph.message import add_messages


class AgentState(TypedDict, total=False):
    """Main state for the tool-calling agent graph."""

    messages: Annotated[list, add_messages]  # Full conversation history (LangChain messages)
    user_id: str  # Scopes all DB operations to this user
    pending_writes: list[dict[str, Any]] | None  # Write tool calls awaiting confirmation
    preview_message: str | None  # Confirmation message shown to user
    status: Literal["processing", "awaiting_info", "awaiting_confirm", "completed"]
    response: str  # Final response text
    tool_calls_log: list[dict[str, Any]]  # Tool call history for API response


# Tool classification for routing
READ_TOOLS = {"search_inventory", "get_batch_details"}
WRITE_TOOLS = {"add_item", "consume_item", "discard_batch", "update_item"}
