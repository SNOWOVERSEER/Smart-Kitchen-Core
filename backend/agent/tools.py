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


# All tools for LLM binding
ALL_TOOLS = [search_inventory, get_batch_details, add_item, consume_item, discard_batch, update_item]
