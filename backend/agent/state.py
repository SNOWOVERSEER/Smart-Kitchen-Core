"""State definitions for the tool-calling LangGraph agent."""

from typing import Annotated, Any, Literal
from typing_extensions import TypedDict

from langgraph.graph.message import add_messages


class AgentState(TypedDict, total=False):
    """Main state for the tool-calling agent graph."""

    messages: Annotated[list, add_messages]
    user_id: str
    pending_writes: list[dict[str, Any]] | None
    preview_message: str | None
    status: Literal["processing", "awaiting_info", "awaiting_confirm", "completed"]
    response: str
    tool_calls_log: list[dict[str, Any]]
    pending_recipes: list[dict[str, Any]] | None  # Generated recipes awaiting save


# Tool classification for routing
READ_TOOLS = {
    "search_inventory", "get_batch_details", "get_shopping_list",
    "search_saved_recipes", "get_recipe_details",
    "get_meals", "get_meal_details",
}
WRITE_TOOLS = {
    "add_item", "consume_item", "discard_batch", "update_item", "add_to_shopping_list",
    "generate_recipes_tool", "save_recipe", "save_all_recipes", "delete_recipe",
    "add_recipe_ingredients_to_shopping",
    "create_meal", "add_recipes_to_meal", "remove_recipe_from_meal", "delete_meal",
}
