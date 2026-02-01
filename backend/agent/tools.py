"""LangChain tools for inventory management. (Legacy!!!!! Not In Use anymore)"""

from datetime import date
from typing import Annotated

from langchain_core.tools import tool
from sqlmodel import Session

from database import engine
from models import InventoryItem
from schemas import InventoryItemCreate
from services import (
    consume_item,
    add_inventory_item,
    get_inventory_grouped,
    discard_batch,
)


def get_session() -> Session:
    """Create a new database session for tool execution."""
    return Session(engine)


@tool
def query_inventory(
    item_name: Annotated[str | None, "Optional: filter by item name"] = None,
) -> str:
    """
    Query current inventory status.
    Use this tool FIRST to see what items are available before consuming.
    Returns a summary of all inventory grouped by item name.
    """
    with get_session() as db:
        groups = get_inventory_grouped(db)

        if not groups:
            return "Inventory is empty. No items found."

        # Filter by item_name if provided
        if item_name:
            groups = [g for g in groups if item_name.lower() in g.item_name.lower()]
            if not groups:
                return f"No items found matching '{item_name}'."

        # Format output for LLM
        lines = ["Current Inventory:"]
        for group in groups:
            lines.append(f"\n📦 {group.item_name}: {group.total_quantity} {group.unit} total")
            for batch in group.batches:
                status = "🔓 OPEN" if batch.is_open else "🔒 sealed"
                expiry = f"expires {batch.expiry_date}" if batch.expiry_date else "no expiry"
                brand = f"({batch.brand})" if batch.brand else ""
                lines.append(
                    f"   - Batch #{batch.id} {brand}: {batch.quantity} {batch.unit}, {status}, {expiry}"
                )

        return "\n".join(lines)


@tool
def consume_inventory(
    item_name: Annotated[str, "The item to consume (e.g., 'Milk', 'Eggs')"],
    amount: Annotated[float, "Amount to consume (e.g., 0.5, 2)"],
    unit: Annotated[str, "Unit of measurement (e.g., 'L', 'kg', 'pcs')"],
    brand: Annotated[str | None, "Optional: specific brand to consume"] = None,
) -> str:
    """
    Consume/use items from inventory using FEFO (First Expired, First Out) logic.

    The system automatically:
    1. Consumes from OPEN items first
    2. Then from items expiring soonest
    3. Cascades across multiple batches if needed

    If brand is specified, only items of that brand will be consumed.
    """
    with get_session() as db:
        result = consume_item(
            db=db,
            item_name=item_name,
            amount=amount,
            brand=brand,
        )

        if not result.success:
            return f"❌ Failed: {result.message}"

        # Format success message
        lines = [f"✅ Successfully consumed {result.consumed_amount} {unit} of {item_name}"]
        lines.append("\nAffected batches:")
        for batch in result.affected_batches:
            brand_str = f" ({batch['brand']})" if batch.get("brand") else ""
            lines.append(
                f"  - Batch #{batch['batch_id']}{brand_str}: "
                f"{batch['old_quantity']} → {batch['new_quantity']} {unit}"
            )

        return "\n".join(lines)


@tool
def add_inventory(
    item_name: Annotated[str, "Item name (e.g., 'Milk', 'Chicken Breast')"],
    quantity: Annotated[float, "Quantity (e.g., 1.0, 500)"],
    unit: Annotated[str, "Unit (e.g., 'L', 'kg', 'g', 'pcs')"],
    brand: Annotated[str | None, "Brand name (e.g., 'A2', 'Coles')"] = None,
    expiry_date: Annotated[str | None, "Expiry date in YYYY-MM-DD format"] = None,
    category: Annotated[str | None, "Category: Dairy, Meat, Veg, Pantry, etc."] = None,
    location: Annotated[str, "Storage location: Fridge, Freezer, or Pantry"] = "Fridge",
) -> str:
    """
    Add a new item batch to inventory.
    Use this when the user bought or received new groceries.
    """
    with get_session() as db:
        # Parse expiry date if provided
        parsed_expiry = None
        if expiry_date:
            try:
                parsed_expiry = date.fromisoformat(expiry_date)
            except ValueError:
                return f"❌ Invalid date format: {expiry_date}. Use YYYY-MM-DD."

        item_data = InventoryItemCreate(
            item_name=item_name,
            brand=brand,
            quantity=quantity,
            total_volume=quantity,  # Initial volume equals quantity
            unit=unit,
            category=category,
            expiry_date=parsed_expiry,
            location=location,
        )

        item = add_inventory_item(db, item_data)

        brand_str = f" ({item.brand})" if item.brand else ""
        expiry_str = f", expires {item.expiry_date}" if item.expiry_date else ""

        return (
            f"✅ Added: {item.quantity} {item.unit} of {item.item_name}{brand_str}\n"
            f"   Batch ID: #{item.id}, Location: {item.location}{expiry_str}"
        )


@tool
def discard_inventory(
    batch_id: Annotated[int, "The batch ID to discard (use query_inventory to find IDs)"],
) -> str:
    """
    Discard/throw away a specific inventory batch.
    Use this when an item is expired, spoiled, or no longer needed.
    You need the batch ID - use query_inventory first to find it.
    """
    with get_session() as db:
        item = discard_batch(db, batch_id)

        if not item:
            return f"❌ Batch #{batch_id} not found."

        return f"✅ Discarded batch #{batch_id}: {item.item_name} ({item.quantity} {item.unit})"


# Export all tools
inventory_tools = [
    query_inventory,
    consume_inventory,
    add_inventory,
    discard_inventory,
]
