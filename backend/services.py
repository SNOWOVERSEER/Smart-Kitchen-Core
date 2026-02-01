"""Business logic services for inventory management."""

from datetime import datetime, timezone
from typing import Any

from sqlmodel import Session, select, func, case, nulls_last

from models import InventoryItem, TransactionLog
from schemas import (
    InventoryItemCreate,
    ConsumeResult,
    InventoryGroupResponse,
    InventoryItemResponse,
)


#Inventory CRUD

def add_inventory_item(db: Session, item: InventoryItemCreate) -> InventoryItem:
    """Add a new inventory batch to the database."""
    db_item = InventoryItem(**item.model_dump())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)

    # Log the transaction
    log_transaction(
        db=db,
        intent="INBOUND",
        operation_details={
            "action": "add",
            "batch_id": db_item.id,
            "item_name": db_item.item_name,
            "quantity": db_item.quantity,
            "unit": db_item.unit,
        },
    )

    return db_item


def get_inventory_grouped(db: Session) -> list[InventoryGroupResponse]:
    """Get all inventory items grouped by item_name."""
    # Get all items with quantity > 0, ordered by item_name
    statement = (
        select(InventoryItem)
        .where(InventoryItem.quantity > 0)
        .order_by(InventoryItem.item_name)
    )
    items = db.exec(statement).all()

    # Group by item_name
    groups: dict[str, list[InventoryItem]] = {}
    for item in items:
        if item.item_name not in groups:
            groups[item.item_name] = []
        groups[item.item_name].append(item)

    # Build response
    result = []
    for item_name, batches in groups.items():
        total_qty = sum(b.quantity for b in batches)
        unit = batches[0].unit if batches else ""
        result.append(
            InventoryGroupResponse(
                item_name=item_name,
                total_quantity=total_qty,
                unit=unit,
                batches=[InventoryItemResponse.model_validate(b) for b in batches],
            )
        )

    return result


def get_all_inventory(db: Session) -> list[InventoryItem]:
    """Get all inventory items (including depleted)."""
    statement = select(InventoryItem).order_by(InventoryItem.item_name)
    return list(db.exec(statement).all())


def discard_batch(db: Session, batch_id: int) -> InventoryItem | None:
    """Discard (delete) a specific batch by ID."""
    item = db.get(InventoryItem, batch_id)
    if not item:
        return None

    # Log before deletion
    log_transaction(
        db=db,
        intent="DISCARD",
        operation_details={
            "action": "discard",
            "batch_id": item.id,
            "item_name": item.item_name,
            "remaining_quantity": item.quantity,
        },
    )

    db.delete(item)
    db.commit()
    return item


#Smart Consumption (FEFO)

def consume_item(
    db: Session,
    item_name: str,
    amount: float,
    brand: str | None = None,
    raw_input: str | None = None,
    ai_reasoning: str | None = None,
) -> ConsumeResult:
    """
    Smart consumption with FEFO (First Expired, First Out) logic.

    Priority:
    1. is_open == True (consume open items first)
    2. expiry_date ASC (consume items expiring soonest, NULL last)

    If brand is specified, filter by brand BEFORE applying sort.
    Cascades across multiple batches if needed.
    """
    # Build query with filters
    statement = (
        select(InventoryItem)
        .where(InventoryItem.item_name == item_name)
        .where(InventoryItem.quantity > 0)
    )

    # Apply brand filter if specified
    if brand:
        statement = statement.where(InventoryItem.brand == brand)

    # FEFO Sort: is_open DESC (True first), then expiry_date ASC (NULL last)
    statement = statement.order_by(
        InventoryItem.is_open.desc(),
        nulls_last(InventoryItem.expiry_date.asc()),
    )

    batches = list(db.exec(statement).all())

    if not batches:
        return ConsumeResult(
            success=False,
            consumed_amount=0,
            remaining_to_consume=amount,
            affected_batches=[],
            message=f"No available batches found for '{item_name}'"
            + (f" (brand: {brand})" if brand else ""),
        )

    # Calculate total available
    total_available = sum(b.quantity for b in batches)
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

        deduct = min(batch.quantity, remaining)
        old_qty = batch.quantity
        batch.quantity = round(batch.quantity - deduct, 3)  # Avoid float precision issues
        remaining = round(remaining - deduct, 3)

        # If batch is now empty or nearly empty (float precision), mark as closed
        if batch.quantity <= 0.001:
            batch.quantity = 0
            batch.is_open = False

        # If we're consuming from this batch, mark it as open
        elif not batch.is_open and deduct > 0:
            batch.is_open = True

        affected.append({
            "batch_id": batch.id,
            "brand": batch.brand,
            "expiry_date": str(batch.expiry_date) if batch.expiry_date else None,
            "deducted": deduct,
            "old_quantity": old_qty,
            "new_quantity": batch.quantity,
        })

    db.commit()

    # Log the transaction
    log_transaction(
        db=db,
        intent="CONSUME",
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


#Transaction Logging

def log_transaction(
    db: Session,
    intent: str,
    raw_input: str | None = None,
    ai_reasoning: str | None = None,
    operation_details: dict[str, Any] | None = None,
) -> TransactionLog:
    """Log a transaction for audit trail."""
    log = TransactionLog(
        intent=intent,
        raw_input=raw_input,
        ai_reasoning=ai_reasoning,
        operation_details=operation_details,
        timestamp=datetime.now(timezone.utc),
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


def get_transaction_logs(db: Session, limit: int = 50) -> list[TransactionLog]:
    """Get recent transaction logs."""
    statement = (
        select(TransactionLog)
        .order_by(TransactionLog.timestamp.desc())
        .limit(limit)
    )
    return list(db.exec(statement).all())
