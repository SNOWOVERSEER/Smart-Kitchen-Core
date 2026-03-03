"""Tool definitions for the Kitchen Loop agent.

These are defined as plain functions with type hints and docstrings.
LangChain converts them to tool schemas for LLM function calling.
The actual execution happens in nodes.py — these serve as
schema definitions that get bound to the LLM via `llm.bind_tools()`.
"""

from typing import Any

from langchain_core.tools import tool


@tool
def search_inventory(
    item_name: str | None = None,
    brand: str | None = None,
    location: str | None = None,
) -> list[dict[str, Any]]:
    """Search the user's current inventory for items matching the given criteria.
    All filters are case-insensitive. Returns matching batches sorted by FEFO order.
    Use this before consuming, updating, or discarding items to understand current state.

    Args:
        item_name: Item name to search for (partial match supported). E.g. "Milk", "Chicken"
        brand: Filter by brand name. E.g. "A2", "Coles"
        location: Filter by storage location. E.g. "Fridge", "Freezer", "Pantry"
    """
    raise NotImplementedError


@tool
def get_batch_details(batch_id: int) -> dict[str, Any] | None:
    """Get detailed information about a specific inventory batch by its ID.

    Args:
        batch_id: The batch ID number to look up.
    """
    raise NotImplementedError


@tool
def add_item(
    item_name: str,
    quantity: float,
    unit: str,
    location: str,
    expiry_date: str | None = None,
    brand: str | None = None,
    category: str | None = None,
    total_volume: float | None = None,
    is_open: bool = False,
) -> dict[str, Any]:
    """Add a new item batch to inventory. Always use English for parameter values.

    Args:
        item_name: Normalized English name. E.g. "Milk", "Chicken Wings", "Rice"
        quantity: Amount of the item. E.g. 1.0, 2.5, 500
        unit: Unit of measurement. Use: "L", "ml", "kg", "g", "pcs"
        location: Storage location. Must be one of: "Fridge", "Freezer", "Pantry"
        expiry_date: Expiry date in YYYY-MM-DD format. E.g. "2026-03-01"
        brand: Brand name in English. E.g. "A2", "Coles", "Woolworths"
        category: Category in English. E.g. "Dairy", "Meat", "Vegetables", "Pantry", "Beverages"
        total_volume: Original package size (defaults to quantity if not specified)
        is_open: Whether the package is already opened. Default false.
    """
    raise NotImplementedError


@tool
def consume_item(
    item_name: str,
    amount: float,
    unit: str | None = None,
    brand: str | None = None,
) -> dict[str, Any]:
    """Consume an item from inventory using FEFO (First Expired, First Out) logic.
    The system automatically deducts from open items first, then by earliest expiry.

    Args:
        item_name: English name of the item to consume. E.g. "Milk", "Eggs"
        amount: How much to consume. E.g. 0.5, 2, 200
        unit: Unit of measurement (optional, uses item's stored unit if omitted)
        brand: Specific brand to consume from (optional, applies FEFO across all brands if omitted)
    """
    raise NotImplementedError


@tool
def discard_batch(
    batch_id: int,
    reason: str | None = None,
) -> dict[str, Any]:
    """Discard an entire batch from inventory (e.g. expired, spoiled).

    Args:
        batch_id: The ID of the batch to discard.
        reason: Optional reason for discarding. E.g. "expired", "spoiled"
    """
    raise NotImplementedError


@tool
def update_item(
    batch_id: int,
    item_name: str | None = None,
    location: str | None = None,
    is_open: bool | None = None,
    quantity: float | None = None,
    expiry_date: str | None = None,
    category: str | None = None,
    brand: str | None = None,
) -> dict[str, Any]:
    """Update an existing inventory batch. Use this for moving items, marking as opened,
    adjusting quantities, correcting information, or renaming an item.

    Args:
        batch_id: The ID of the batch to update.
        item_name: New English item name (for renaming, e.g. "Coca Cola" -> "Coke").
        location: New storage location. Must be: "Fridge", "Freezer", or "Pantry"
        is_open: Whether the package is open.
        quantity: New quantity value (for manual adjustments like "I have 3 left").
        expiry_date: New expiry date in YYYY-MM-DD format.
        category: New category in English.
        brand: New brand name in English.
    """
    raise NotImplementedError


@tool
def get_shopping_list() -> list[dict]:
    """Get the user's current shopping list, unchecked items first.
    Use this before adding items to check if something is already on the list."""
    raise NotImplementedError


@tool
def add_to_shopping_list(
    item_name: str,
    quantity: float | None = None,
    unit: str | None = None,
    note: str | None = None,
) -> dict:
    """Add an item to the user's shopping list. Use when the user wants to buy something.

    Args:
        item_name: English name of the item. E.g. "Milk", "Eggs", "Bread"
        quantity: How much to buy (optional). E.g. 2.0, 500
        unit: Unit of measurement (optional). E.g. "L", "kg", "pcs"
        note: Optional note about the item. E.g. "organic", "low fat"
    """
    raise NotImplementedError


@tool
def search_saved_recipes(query: str = "") -> str:
    """Search user's saved recipes by title or tags.

    Args:
        query: Optional search keyword to match against recipe titles or tags.
               Leave empty to list recent saved recipes.
    """
    raise NotImplementedError


@tool
def get_recipe_details(recipe_id: int) -> str:
    """Get full details of a saved recipe including ingredients and instructions.

    Args:
        recipe_id: The ID of the saved recipe to retrieve.
    """
    raise NotImplementedError


@tool
def generate_recipes_tool(prompt: str, categories: str = "", use_expiring: bool = False) -> str:
    """Generate new recipe suggestions based on user's inventory and preferences.

    Use this when the user explicitly asks you to generate or suggest recipe cards.
    Do NOT use this for casual food questions — just answer those with your knowledge.

    Args:
        prompt: What the user wants — a dish name, cuisine preference, or general request.
        categories: Comma-separated category filters. E.g. "asian,quick,vegetarian".
        use_expiring: If true, prioritize ingredients expiring within 7 days.
    """
    raise NotImplementedError


@tool
def save_recipe(recipe_title: str) -> str:
    """Save a recipe from the most recently generated batch.

    Only works after generate_recipes_tool has been called in this conversation.

    Args:
        recipe_title: The exact title of the recipe to save.
    """
    raise NotImplementedError


@tool
def save_all_recipes() -> str:
    """Save ALL recipes from the most recently generated batch at once.

    Use this when the user wants to save all generated recipes (e.g. "save them all", "全部保存").
    Only works after generate_recipes_tool has been called in this conversation.
    """
    raise NotImplementedError


@tool
def delete_recipe(recipe_id: int) -> str:
    """Delete a saved recipe from the user's collection.

    Args:
        recipe_id: The ID of the saved recipe to delete.
    """
    raise NotImplementedError


@tool
def add_recipe_ingredients_to_shopping(recipe_id: int) -> str:
    """Add all missing ingredients from a saved recipe to the shopping list.

    Only adds ingredients that are NOT currently in stock.

    Args:
        recipe_id: The ID of the saved recipe.
    """
    raise NotImplementedError


@tool
def get_meals(date_from: str | None = None, date_to: str | None = None) -> list[dict]:
    """Get the user's meals. Optionally filter by date range.

    Args:
        date_from: Start date in YYYY-MM-DD format (optional).
        date_to: End date in YYYY-MM-DD format (optional).
    """
    raise NotImplementedError


@tool
def get_meal_details(meal_id: int) -> dict:
    """Get full details of a specific meal including its recipes.

    Args:
        meal_id: The ID of the meal to retrieve.
    """
    raise NotImplementedError


@tool
def create_meal(name: str, recipe_ids: str = "", scheduled_date: str | None = None, meal_type: str | None = None) -> dict:
    """Create a new meal (a named recipe collection).

    Args:
        name: Name of the meal in English. E.g. "Weekend BBQ", "Tuesday Dinner"
        recipe_ids: Comma-separated saved recipe IDs to include. E.g. "12,34,56"
        scheduled_date: Optional date in YYYY-MM-DD format.
        meal_type: Optional meal type: "breakfast", "lunch", "dinner", or "snack".
    """
    raise NotImplementedError


@tool
def add_recipes_to_meal(meal_id: int, recipe_ids: str) -> dict:
    """Add saved recipes to an existing meal.

    Args:
        meal_id: The meal ID to add recipes to.
        recipe_ids: Comma-separated saved recipe IDs. E.g. "12,34"
    """
    raise NotImplementedError


@tool
def remove_recipe_from_meal(meal_id: int, recipe_id: int) -> dict:
    """Remove a recipe from a meal.

    Args:
        meal_id: The meal ID.
        recipe_id: The recipe ID to remove.
    """
    raise NotImplementedError


@tool
def delete_meal(meal_id: int) -> str:
    """Delete a meal entirely.

    Args:
        meal_id: The ID of the meal to delete.
    """
    raise NotImplementedError


# All tools for LLM binding
ALL_TOOLS = [
    search_inventory, get_batch_details, get_shopping_list,
    add_item, consume_item, discard_batch, update_item, add_to_shopping_list,
    search_saved_recipes, get_recipe_details, generate_recipes_tool,
    save_recipe, save_all_recipes, delete_recipe, add_recipe_ingredients_to_shopping,
    get_meals, get_meal_details,
    create_meal, add_recipes_to_meal, remove_recipe_from_meal, delete_meal,
]
