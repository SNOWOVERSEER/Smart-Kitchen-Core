"""Business logic services using Supabase client."""

from typing import Any

from database import get_supabase_client
from schemas import (
    InventoryItemCreate,
    ConsumeResult,
    InventoryGroupResponse,
    InventoryItemResponse,
)


# ── Inventory CRUD ──

def add_inventory_item(
    user_id: str,
    item: InventoryItemCreate,
    thread_id: str | None = None,
    raw_input: str | None = None,
) -> dict:
    """Add a new inventory batch."""
    supabase = get_supabase_client()

    data = {
        "user_id": user_id,
        **item.model_dump(),
    }
    # Convert date to string for JSON
    if data.get("expiry_date"):
        data["expiry_date"] = str(data["expiry_date"])

    result = supabase.table("inventory").insert(data).execute()
    row = result.data[0]

    log_transaction(
        user_id=user_id,
        intent="INBOUND",
        thread_id=thread_id,
        raw_input=raw_input,
        operation_details={
            "action": "add",
            "batch_id": row["id"],
            "item_name": row["item_name"],
            "quantity": row["quantity"],
            "unit": row["unit"],
        },
    )

    return row


def get_inventory_grouped(user_id: str) -> list[InventoryGroupResponse]:
    """Get inventory grouped by item_name for a user."""
    supabase = get_supabase_client()

    result = (
        supabase.table("inventory")
        .select("*")
        .eq("user_id", user_id)
        .gt("quantity", 0)
        .order("item_name")
        .execute()
    )

    # Group by item_name
    groups: dict[str, list[dict]] = {}
    for row in result.data:
        name = row["item_name"]
        if name not in groups:
            groups[name] = []
        groups[name].append(row)

    output = []
    for item_name, batches in groups.items():
        total_qty = sum(b["quantity"] for b in batches)
        unit = batches[0]["unit"] if batches else ""
        output.append(
            InventoryGroupResponse(
                item_name=item_name,
                total_quantity=total_qty,
                unit=unit,
                batches=[InventoryItemResponse(**b) for b in batches],
            )
        )

    return output


def get_all_inventory(user_id: str) -> list[dict]:
    """Get all inventory batches for a user."""
    supabase = get_supabase_client()
    result = (
        supabase.table("inventory")
        .select("*")
        .eq("user_id", user_id)
        .order("item_name")
        .execute()
    )
    return result.data


def discard_batch(
    user_id: str,
    batch_id: int,
    thread_id: str | None = None,
    raw_input: str | None = None,
) -> dict | None:
    """Discard a specific batch by ID."""
    supabase = get_supabase_client()

    # Fetch first to get details for logging
    fetch = (
        supabase.table("inventory")
        .select("*")
        .eq("id", batch_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not fetch.data:
        return None

    item = fetch.data[0]

    log_transaction(
        user_id=user_id,
        intent="DISCARD",
        thread_id=thread_id,
        raw_input=raw_input,
        operation_details={
            "action": "discard",
            "batch_id": item["id"],
            "item_name": item["item_name"],
            "remaining_quantity": item["quantity"],
        },
    )

    supabase.table("inventory").delete().eq("id", batch_id).eq("user_id", user_id).execute()
    return item


# ── Smart Consumption (FEFO) ──

def consume_item(
    user_id: str,
    item_name: str,
    amount: float,
    brand: str | None = None,
    thread_id: str | None = None,
    raw_input: str | None = None,
    ai_reasoning: str | None = None,
) -> ConsumeResult:
    """FEFO consumption scoped to user."""
    supabase = get_supabase_client()

    # Build query
    query = (
        supabase.table("inventory")
        .select("*")
        .eq("user_id", user_id)
        .eq("item_name", item_name)
        .gt("quantity", 0)
    )

    if brand:
        query = query.eq("brand", brand)

    # FEFO sort: is_open DESC, expiry_date ASC (nulls last)
    result = query.order("is_open", desc=True).order("expiry_date", nullsfirst=False).execute()
    batches = result.data

    if not batches:
        return ConsumeResult(
            success=False,
            consumed_amount=0,
            remaining_to_consume=amount,
            affected_batches=[],
            message=f"No available batches found for '{item_name}'"
            + (f" (brand: {brand})" if brand else ""),
        )

    total_available = sum(b["quantity"] for b in batches)
    if total_available < amount:
        return ConsumeResult(
            success=False,
            consumed_amount=0,
            remaining_to_consume=amount,
            affected_batches=[],
            message=f"Insufficient stock. Available: {total_available}, Requested: {amount}",
        )

    # Cascade deduction
    remaining = amount
    affected: list[dict[str, Any]] = []

    for batch in batches:
        if remaining <= 0:
            break

        deduct = min(batch["quantity"], remaining)
        old_qty = batch["quantity"]
        new_qty = round(batch["quantity"] - deduct, 3)
        remaining = round(remaining - deduct, 3)

        update_data: dict[str, Any] = {}
        if new_qty <= 0.001:
            update_data = {"quantity": 0, "is_open": False}
            new_qty = 0
        elif not batch["is_open"] and deduct > 0:
            update_data = {"quantity": new_qty, "is_open": True}
        else:
            update_data = {"quantity": new_qty}

        supabase.table("inventory").update(update_data).eq("id", batch["id"]).execute()

        affected.append({
            "batch_id": batch["id"],
            "brand": batch.get("brand"),
            "expiry_date": batch.get("expiry_date"),
            "deducted": deduct,
            "old_quantity": old_qty,
            "new_quantity": new_qty,
        })

    log_transaction(
        user_id=user_id,
        intent="CONSUME",
        thread_id=thread_id,
        raw_input=raw_input,
        ai_reasoning=ai_reasoning,
        operation_details={
            "item_name": item_name,
            "brand_filter": brand,
            "requested_amount": amount,
            "consumed_amount": amount - remaining,
            "affected_batches": affected,
        },
    )

    return ConsumeResult(
        success=True,
        consumed_amount=amount - remaining,
        remaining_to_consume=remaining,
        affected_batches=affected,
        message=f"Successfully consumed {amount - remaining} {item_name}",
    )


# ── Transaction Logging ──

def log_transaction(
    user_id: str,
    intent: str,
    thread_id: str | None = None,
    raw_input: str | None = None,
    ai_reasoning: str | None = None,
    operation_details: dict[str, Any] | None = None,
) -> dict:
    """Log a transaction for audit trail."""
    supabase = get_supabase_client()
    data = {
        "user_id": user_id,
        "intent": intent,
        "thread_id": thread_id,
        "raw_input": raw_input,
        "ai_reasoning": ai_reasoning,
        "operation_details": operation_details,
    }
    result = supabase.table("transaction_logs").insert(data).execute()
    return result.data[0]


def get_transaction_logs(user_id: str, limit: int = 50) -> list[dict]:
    """Get recent transaction logs for a user."""
    supabase = get_supabase_client()
    result = (
        supabase.table("transaction_logs")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data
