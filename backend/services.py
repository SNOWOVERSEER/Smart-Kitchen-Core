"""Business logic services using Supabase client."""

from datetime import date, timedelta
from typing import Any, Literal

from database import get_supabase_client
from schemas import (
    InventoryItemCreate,
    InventoryItemUpdate,
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
            "brand": row.get("brand"),
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
            "unit": item["unit"],
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
        .ilike("item_name", item_name)
        .gt("quantity", 0)
    )

    if brand:
        query = query.ilike("brand", brand)

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


def update_inventory_item(
    user_id: str,
    batch_id: int,
    update: InventoryItemUpdate,
) -> dict | None:
    """Partially update an existing inventory batch."""
    supabase = get_supabase_client()

    data = {k: v for k, v in update.model_dump().items() if v is not None}
    if "expiry_date" in data:
        data["expiry_date"] = str(data["expiry_date"])

    if not data:
        fetch = (
            supabase.table("inventory")
            .select("*")
            .eq("id", batch_id)
            .eq("user_id", user_id)
            .execute()
        )
        return fetch.data[0] if fetch.data else None

    result = (
        supabase.table("inventory")
        .update(data)
        .eq("id", batch_id)
        .eq("user_id", user_id)
        .execute()
    )
    return result.data[0] if result.data else None


def search_inventory(
    user_id: str,
    item_name: str | None = None,
    brand: str | None = None,
    location: str | None = None,
) -> list[dict]:
    """Flexible inventory search with case-insensitive matching."""
    supabase = get_supabase_client()
    query = (
        supabase.table("inventory")
        .select("*")
        .eq("user_id", user_id)
        .gt("quantity", 0)
    )

    if item_name:
        query = query.ilike("item_name", f"%{item_name}%")
    if brand:
        query = query.ilike("brand", brand)
    if location:
        query = query.ilike("location", location)

    result = query.order("is_open", desc=True).order("expiry_date", nullsfirst=False).execute()
    return result.data


def update_batch(
    user_id: str,
    batch_id: int,
    updates: dict,
    thread_id: str | None = None,
    raw_input: str | None = None,
) -> dict | None:
    """Update mutable fields on an inventory batch."""
    supabase = get_supabase_client()

    # Only allow safe fields (item_name included for renaming)
    allowed = {"item_name", "location", "is_open", "quantity", "expiry_date", "category", "brand"}
    safe_updates = {k: v for k, v in updates.items() if k in allowed and v is not None}

    if not safe_updates:
        return None

    # Convert date to string
    if "expiry_date" in safe_updates:
        safe_updates["expiry_date"] = str(safe_updates["expiry_date"])

    result = (
        supabase.table("inventory")
        .update(safe_updates)
        .eq("id", batch_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not result.data:
        return None

    row = result.data[0]

    log_transaction(
        user_id=user_id,
        intent="UPDATE",
        thread_id=thread_id,
        raw_input=raw_input,
        operation_details={
            "action": "update",
            "batch_id": batch_id,
            "item_name": row["item_name"],
            "updates": safe_updates,
        },
    )

    return row


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


# ── Recipe services ──

def _format_inventory_for_prompt(items: list[dict]) -> str:
    """Format inventory rows into a readable prompt block for LLM context."""
    lines = []
    for item in items:
        line = f"- {item['item_name']}"
        if item.get("brand"):
            line += f" ({item['brand']})"
        line += f": {item.get('quantity', '?')} {item.get('unit', '')}"
        if item.get("expiry_date"):
            line += f", expires {item['expiry_date']}"
        lines.append(line)
    return "\n".join(lines) if lines else "No inventory items found."


def generate_recipes(user_id: str, mode: Literal['expiring', 'feeling'], prompt: str | None) -> dict:
    """
    Call the user's LLM with structured output to generate 4 recipe cards.
    For 'expiring' mode: fetches items expiring within 7 days.
    For 'feeling' mode: passes user's prompt + general inventory.
    Returns dict matching GenerateRecipesResponse schema.
    Raises ValueError on LLM failure.
    """
    from schemas import RecipeCard
    from agent.llm_factory import get_user_llm
    from pydantic import BaseModel as _BaseModel

    class _Output(_BaseModel):
        recipes: list[RecipeCard]

    llm = get_user_llm(user_id)
    structured_llm = llm.with_structured_output(_Output)
    supabase = get_supabase_client()
    all_inv = [item for item in get_all_inventory(user_id) if (item.get("quantity") or 0) > 0]

    if mode == "expiring":
        cutoff = (date.today() + timedelta(days=7)).isoformat()
        result = (supabase.table("inventory")
            .select("item_name, brand, quantity, unit, expiry_date")
            .eq("user_id", user_id).gt("quantity", 0)
            .lte("expiry_date", cutoff).not_.is_("expiry_date", "null")
            .order("expiry_date").limit(20).execute())
        expiring = result.data or []
        if expiring:
            inventory_text = _format_inventory_for_prompt(expiring)
            mode_instruction = "Generate 4 recipes that use these items expiring soon. Prioritise recipes that use multiple expiring items together."
        else:
            inventory_text = _format_inventory_for_prompt(all_inv[:15])
            mode_instruction = "Generate 4 recipes using ingredients from this inventory:"
    else:
        inventory_text = _format_inventory_for_prompt(all_inv[:20])
        user_request = prompt or "something delicious"
        mode_instruction = f'Generate 4 recipes matching this request: "{user_request}"'

    system_prompt = f"""You are a creative recipe assistant.
{mode_instruction}

Available inventory:
{inventory_text}

Rules:
1. Include ALL ingredients each recipe needs — not only ones in stock.
2. For each ingredient, set have_in_stock=true if a semantically matching item exists in the inventory above.
   Match using culinary knowledge: "ground pork" matches "pork mince", "猪绞肉" matches "Coles pork mince".
   Do NOT do exact string matching.
3. Do NOT invent implausible ingredient combinations.
4. instructions: numbered steps as separate strings (not a paragraph).
5. cook_time_min: total time including prep.
6. tags: lowercase English only. E.g. ["quick", "vegetarian", "asian"].
7. All field values in English.
"""

    try:
        output: _Output = structured_llm.invoke(system_prompt)
        recipes = output.recipes
        # Post-process: populate batch_ids via substring match (best-effort)
        for recipe in recipes:
            for ingredient in recipe.ingredients:
                if ingredient.have_in_stock:
                    ingredient.batch_ids = [
                        item["id"] for item in all_inv
                        if (ingredient.name.lower() in item["item_name"].lower()
                            or item["item_name"].lower() in ingredient.name.lower())
                    ]
        return {"recipes": [r.model_dump() for r in recipes]}
    except Exception as exc:
        raise ValueError(f"Recipe generation failed: {exc}") from exc


def save_recipe(
    user_id: str,
    recipe: dict,
    source_mode: str,
    source_prompt: str | None,
) -> dict:
    """Persist a liked recipe into saved_recipes. Returns saved row."""
    supabase = get_supabase_client()
    result = supabase.table("saved_recipes").insert({
        "user_id": user_id,
        "title": recipe["title"],
        "description": recipe.get("description"),
        "cook_time_min": recipe.get("cook_time_min"),
        "servings": recipe.get("servings"),
        "ingredients": recipe.get("ingredients", []),
        "instructions": recipe.get("instructions", []),
        "tags": recipe.get("tags", []),
        "source_mode": source_mode,
        "source_prompt": source_prompt,
    }).execute()
    return result.data[0]


def get_saved_recipes(user_id: str, limit: int = 20, offset: int = 0) -> list[dict]:
    """Return user's saved recipes ordered by created_at DESC."""
    supabase = get_supabase_client()
    result = (supabase.table("saved_recipes")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .offset(offset)
        .execute())
    return result.data or []


def get_saved_recipe(user_id: str, recipe_id: int) -> dict | None:
    """Fetch single saved recipe by ID, scoped to user."""
    supabase = get_supabase_client()
    result = (supabase.table("saved_recipes")
        .select("*")
        .eq("id", recipe_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute())
    return result.data[0] if result.data else None


def delete_saved_recipe(user_id: str, recipe_id: int) -> bool:
    """Delete recipe by ID. Returns True if found and deleted."""
    supabase = get_supabase_client()
    result = (supabase.table("saved_recipes")
        .delete()
        .eq("id", recipe_id)
        .eq("user_id", user_id)
        .execute())
    return bool(result.data)
