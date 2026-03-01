"""Business logic services using Supabase client."""

from datetime import date, timedelta
import re
from typing import Any

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


RECIPES_PER_GENERATION = 6  # Change this to generate more or fewer recipes per request

_UNIT_ALIASES: dict[str, str] = {
    "l": "L",
    "liter": "L",
    "litre": "L",
    "liters": "L",
    "litres": "L",
    "ml": "ml",
    "milliliter": "ml",
    "millilitre": "ml",
    "milliliters": "ml",
    "millilitres": "ml",
    "tbsp": "tbsp",
    "tablespoon": "tbsp",
    "tablespoons": "tbsp",
    "tsp": "tsp",
    "teaspoon": "tsp",
    "teaspoons": "tsp",
    "cup": "cup",
    "cups": "cup",
    "kg": "kg",
    "kilogram": "kg",
    "kilograms": "kg",
    "g": "g",
    "gram": "g",
    "grams": "g",
    "pcs": "pcs",
    "piece": "pcs",
    "pieces": "pcs",
    "unit": "pcs",
    "units": "pcs",
}

_VOLUME_TO_ML = {"L": 1000.0, "ml": 1.0, "cup": 240.0, "tbsp": 15.0, "tsp": 5.0}
_WEIGHT_TO_G = {"kg": 1000.0, "g": 1.0}
_COUNT_UNITS = {"pcs"}
# Approximate densities for common pantry items so volume-vs-weight recipe units
# can still map to inventory quantities in a practical way.
_INGREDIENT_DENSITY_G_PER_ML: dict[str, float] = {
    "flour": 0.50,          # ~120 g / cup
    "sugar": 0.83,          # ~200 g / cup (granulated)
    "butter": 0.95,         # ~227 g / cup
    "baking powder": 0.80,  # ~4 g / tsp
    "cream": 0.98,          # heavy/whipping cream, close to water
    "vegetable oil": 0.92,  # typical cooking oil density
}
_INGREDIENT_DENSITY_ALIASES: dict[str, tuple[str, ...]] = {
    "flour": (
        "flour", "plain flour", "all purpose flour", "all-purpose flour",
        "self raising flour", "self-raising flour", "cake flour",
    ),
    "sugar": (
        "sugar", "granulated sugar", "white sugar", "caster sugar",
        "brown sugar", "powdered sugar", "icing sugar",
    ),
    "butter": ("butter", "unsalted butter", "salted butter"),
    "baking powder": ("baking powder",),
    "cream": ("cream", "whipping cream", "whipped cream", "heavy cream", "thickened cream"),
    "vegetable oil": ("vegetable oil", "canola oil", "sunflower oil", "olive oil"),
}
_GENERIC_LIQUID_DENSITY_G_PER_ML = 1.0
_GENERIC_LIQUID_KEYWORDS: tuple[str, ...] = (
    "milk",
    "cream",
    "broth",
    "stock",
    "soup",
    "sauce",
    "juice",
    "vinegar",
    "water",
    "wine",
    "coffee",
    "tea",
)
_GENERIC_LIQUID_CATEGORIES = {"beverage", "dairy", "condiment", "sauce"}


def _normalize_unit(unit: str | None) -> str | None:
    if not unit:
        return None
    key = unit.strip().lower()
    return _UNIT_ALIASES.get(key, key)


def _convert_amount(value: float | int | None, unit: str | None) -> tuple[str, float] | None:
    if value is None:
        return None
    try:
        amount = float(value)
    except (TypeError, ValueError):
        return None
    if amount < 0:
        return None

    normalized = _normalize_unit(unit)
    if not normalized:
        return None

    if normalized in _VOLUME_TO_ML:
        return ("volume", amount * _VOLUME_TO_ML[normalized])
    if normalized in _WEIGHT_TO_G:
        return ("weight", amount * _WEIGHT_TO_G[normalized])
    if normalized in _COUNT_UNITS:
        return ("count", amount)
    return None


def _normalize_name(name: str | None) -> str:
    if not name:
        return ""
    return re.sub(r"\s+", " ", name.strip().lower())


def _name_tokens(name: str) -> list[str]:
    return [tok for tok in re.findall(r"[\w]+", _normalize_name(name)) if tok]


def _ingredient_matches_inventory_name(ingredient_name: str, inventory_name: str) -> bool:
    ing_norm = _normalize_name(ingredient_name)
    inv_norm = _normalize_name(inventory_name)
    if not ing_norm or not inv_norm:
        return False

    if ing_norm in inv_norm or inv_norm in ing_norm:
        return True

    ing_tokens = set(_name_tokens(ing_norm))
    inv_tokens = set(_name_tokens(inv_norm))
    if not ing_tokens or not inv_tokens:
        return False

    overlap = ing_tokens & inv_tokens
    threshold = 1 if min(len(ing_tokens), len(inv_tokens)) <= 2 else 2
    return len(overlap) >= threshold


def _estimate_density_g_per_ml(ingredient_name: str | None, matched_items: list[dict]) -> float | None:
    candidates = [ingredient_name or ""]
    candidates.extend(str(item.get("item_name") or "") for item in matched_items)
    for candidate in candidates:
        normalized = _normalize_name(candidate)
        if not normalized:
            continue
        for canonical, aliases in _INGREDIENT_DENSITY_ALIASES.items():
            if any(alias in normalized for alias in aliases):
                return _INGREDIENT_DENSITY_G_PER_ML[canonical]

    # Fallback for liquid-like ingredients where strict weight-volume mismatch
    # would otherwise produce false negatives (e.g. 300g cream vs 100ml required).
    for candidate in candidates:
        normalized = _normalize_name(candidate)
        if normalized and any(keyword in normalized for keyword in _GENERIC_LIQUID_KEYWORDS):
            return _GENERIC_LIQUID_DENSITY_G_PER_ML

    for item in matched_items:
        category = _normalize_name(item.get("category") or "")
        if category in _GENERIC_LIQUID_CATEGORIES:
            return _GENERIC_LIQUID_DENSITY_G_PER_ML
    return None


def _is_ingredient_covered_by_inventory(
    ingredient: Any, matched_items: list[dict]
) -> tuple[bool, float | None]:
    """Returns (is_covered, coverage_ratio).

    coverage_ratio is available/required (may be >1.0 if over-stocked).
    Returns None when quantity comparison is not applicable (no qty, unknown units, no matches).
    """
    if not matched_items:
        return False, None

    ing_name = ingredient.get("name") if isinstance(ingredient, dict) else getattr(ingredient, "name", None)
    req_qty = ingredient.get("quantity") if isinstance(ingredient, dict) else getattr(ingredient, "quantity", None)
    req_unit = ingredient.get("unit") if isinstance(ingredient, dict) else getattr(ingredient, "unit", None)

    # If recipe didn't specify amount, semantic match is enough.
    if req_qty is None:
        return True, None

    req_converted = _convert_amount(req_qty, req_unit)
    # Unknown units like "pinch" can't be compared robustly — treat semantic match as covered.
    if req_converted is None:
        return True, None

    req_dimension, req_amount = req_converted
    density_g_per_ml = _estimate_density_g_per_ml(ing_name, matched_items)
    available = 0.0
    for item in matched_items:
        inv_converted = _convert_amount(item.get("quantity"), item.get("unit"))
        if not inv_converted:
            continue
        inv_dimension, inv_amount = inv_converted
        if inv_dimension == req_dimension:
            available += inv_amount
            continue

        # Cross-dimension conversion for known ingredients (e.g. flour cup <-> grams).
        if density_g_per_ml:
            if req_dimension == "volume" and inv_dimension == "weight":
                available += inv_amount / density_g_per_ml
            elif req_dimension == "weight" and inv_dimension == "volume":
                available += inv_amount * density_g_per_ml

    ratio = available / req_amount if req_amount > 0 else 1.0
    return available + 1e-9 >= req_amount, ratio


def _refresh_recipe_ingredient_stock(recipe_row: dict, inventory_rows: list[dict]) -> dict:
    """Recompute ingredient stock flags for saved recipes against current inventory."""
    ingredients = recipe_row.get("ingredients") or []
    refreshed_ingredients: list[dict] = []

    for ingredient in ingredients:
        ing_name = ingredient.get("name") if isinstance(ingredient, dict) else getattr(ingredient, "name", "")
        matched_items = [
            item for item in inventory_rows
            if _ingredient_matches_inventory_name(ing_name, item.get("item_name"))
        ]
        covered, ratio = _is_ingredient_covered_by_inventory(ingredient, matched_items)

        ing_dict = dict(ingredient) if isinstance(ingredient, dict) else {}
        ing_dict["have_in_stock"] = covered
        # Always expose ratio when computable — UI shows "have ~X / need Y" for every ingredient
        # ratio is None only when units are incomparable (no conversion path available)
        ing_dict["coverage_ratio"] = ratio
        ing_dict["batch_ids"] = [item["id"] for item in matched_items] if covered else []
        refreshed_ingredients.append(ing_dict)

    refreshed_row = dict(recipe_row)
    refreshed_row["ingredients"] = refreshed_ingredients
    return refreshed_row


def generate_recipes(user_id: str, categories: list[str], use_expiring: bool, prompt: str | None) -> dict:
    """
    Call the user's LLM with structured output to generate RECIPES_PER_GENERATION recipe cards.
    If use_expiring=True: fetches items expiring within 7 days (falls back to general inventory if none found).
    If categories is non-empty: appends a style/category focus instruction.
    If prompt is provided: appends user's special request.
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

    if use_expiring:
        cutoff = (date.today() + timedelta(days=7)).isoformat()
        result = (supabase.table("inventory")
            .select("item_name, brand, quantity, unit, expiry_date")
            .eq("user_id", user_id).gt("quantity", 0)
            .lte("expiry_date", cutoff).not_.is_("expiry_date", "null")
            .order("expiry_date").limit(20).execute())
        expiring = result.data or []
        if expiring:
            inventory_text = _format_inventory_for_prompt(expiring)
            mode_instruction = "Prioritize using these expiring items:"
        else:
            inventory_text = _format_inventory_for_prompt(all_inv[:15])
            mode_instruction = f"Generate {RECIPES_PER_GENERATION} recipes using ingredients from this inventory:"
    else:
        inventory_text = _format_inventory_for_prompt(all_inv[:20])
        mode_instruction = f"Generate {RECIPES_PER_GENERATION} recipes using ingredients from this inventory:"

    if categories:
        mode_instruction += f" Focus on these styles/categories: {', '.join(categories)}."

    if prompt:
        mode_instruction += f' User special request: "{prompt}"'

    if not use_expiring and not categories and not prompt:
        mode_instruction = f"Generate {RECIPES_PER_GENERATION} recipes using ingredients from this inventory:"

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
8. image_prompt: Write a vivid 1-sentence DALL-E prompt for a professional food photo of this dish. E.g. "A steaming bowl of beef pho with fresh herbs and lime, Vietnamese street food aesthetic, warm natural light."
"""

    try:
        output: _Output = structured_llm.invoke(system_prompt)
        recipes = output.recipes
        # Post-process: make have_in_stock deterministic and unit-aware
        # so measurements like tbsp/tsp vs ml/L don't produce false missing tags.
        for recipe in recipes:
            for ingredient in recipe.ingredients:
                matched_items = [
                    item for item in all_inv
                    if _ingredient_matches_inventory_name(ingredient.name, item.get("item_name"))
                ]
                covered, ratio = _is_ingredient_covered_by_inventory(ingredient, matched_items)
                ingredient.have_in_stock = bool(ingredient.have_in_stock or covered)
                in_stock = ingredient.have_in_stock
                # Always expose ratio when computable — UI shows "have ~X / need Y" for every ingredient
                ingredient.coverage_ratio = ratio
                ingredient.batch_ids = [item["id"] for item in matched_items] if in_stock else []
        return {"recipes": [r.model_dump() for r in recipes]}
    except Exception as exc:
        raise ValueError(f"Recipe generation failed: {exc}") from exc


def generate_recipe_image(recipe_id: int, image_prompt: str, user_id: str) -> str | None:
    """Generate a DALL-E image for a saved recipe. Returns URL or None (non-blocking)."""
    supabase = get_supabase_client()
    # Get user's active AI config
    config_result = (supabase.table("user_ai_configs")
        .select("provider, api_key_secret_id")
        .eq("user_id", user_id)
        .eq("is_active", True)
        .execute())
    if not config_result.data or config_result.data[0]["provider"] != "openai":
        return None
    # Decrypt API key using Vault — same pattern as llm_factory.py
    secret_id = config_result.data[0]["api_key_secret_id"]
    try:
        from openai import OpenAI
        # Decrypt API key from Vault using the same RPC call as llm_factory.py
        secret_result = supabase.rpc(
            "get_decrypted_secret",
            {"secret_id": secret_id},
        ).execute()
        api_key = secret_result.data
        client = OpenAI(api_key=api_key)
        resp = client.images.generate(
            model="dall-e-3",
            prompt=image_prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )
        url = resp.data[0].url
        # Persist URL and verify write actually succeeded (avoid false-positive success).
        supabase.table("saved_recipes").update({"image_url": url}).eq("id", recipe_id).eq("user_id", user_id).execute()
        verify = (
            supabase.table("saved_recipes")
            .select("image_url")
            .eq("id", recipe_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        if not verify.data:
            print(f"[IMAGE] Failed to persist image_url: recipe #{recipe_id} not found for user {user_id}")
            return None
        persisted_url = verify.data[0].get("image_url")
        if not persisted_url:
            print(f"[IMAGE] Failed to persist image_url: recipe #{recipe_id} still has NULL image_url")
            return None
        return persisted_url
    except Exception as e:
        print(f"[IMAGE] generate_recipe_image failed for recipe #{recipe_id}: {e}")
        return None  # Never fail a save because of image generation


def save_recipe(
    user_id: str,
    recipe: dict,
    source_mode: str,
    source_prompt: str | None,
    image_prompt: str | None = None,
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
        "image_prompt": image_prompt,
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
    rows = result.data or []
    if not rows:
        return []

    live_inventory = [item for item in get_all_inventory(user_id) if (item.get("quantity") or 0) > 0]
    return [_refresh_recipe_ingredient_stock(row, live_inventory) for row in rows]


def get_saved_recipe(user_id: str, recipe_id: int) -> dict | None:
    """Fetch single saved recipe by ID, scoped to user."""
    supabase = get_supabase_client()
    result = (supabase.table("saved_recipes")
        .select("*")
        .eq("id", recipe_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute())
    if not result.data:
        return None

    live_inventory = [item for item in get_all_inventory(user_id) if (item.get("quantity") or 0) > 0]
    return _refresh_recipe_ingredient_stock(result.data[0], live_inventory)


def delete_saved_recipe(user_id: str, recipe_id: int) -> bool:
    """Delete recipe by ID. Returns True if found and deleted."""
    supabase = get_supabase_client()
    result = (supabase.table("saved_recipes")
        .delete()
        .eq("id", recipe_id)
        .eq("user_id", user_id)
        .execute())
    return bool(result.data)


# ── Shopping list services ──

def get_shopping_items(user_id: str) -> list[dict]:
    """Return all shopping items for user, unchecked items first."""
    supabase = get_supabase_client()
    result = (supabase.table("shopping_items")
        .select("*")
        .eq("user_id", user_id)
        .order("is_checked")        # False (unchecked) first
        .order("created_at", desc=True)
        .execute())
    return result.data or []


def add_shopping_item(user_id: str, item: "ShoppingItemCreate") -> dict:
    """Insert a single shopping item for the user."""
    supabase = get_supabase_client()
    data = item.model_dump()
    data["user_id"] = user_id
    result = supabase.table("shopping_items").insert(data).execute()
    return result.data[0]


def add_shopping_items_bulk(user_id: str, items: list["ShoppingItemCreate"]) -> list[dict]:
    """Bulk insert shopping items — single Supabase round-trip."""
    supabase = get_supabase_client()
    rows = [{"user_id": user_id, **item.model_dump()} for item in items]
    result = supabase.table("shopping_items").insert(rows).execute()
    return result.data or []


def update_shopping_item(
    user_id: str,
    item_id: int,
    update: "ShoppingItemUpdate",
) -> dict | None:
    """Partial update on a shopping item. Skips None fields."""
    supabase = get_supabase_client()
    patch = {k: v for k, v in update.model_dump().items() if v is not None}
    if not patch:
        fetch = (supabase.table("shopping_items")
            .select("*")
            .eq("id", item_id)
            .eq("user_id", user_id)
            .execute())
        return fetch.data[0] if fetch.data else None
    result = (supabase.table("shopping_items")
        .update(patch)
        .eq("id", item_id)
        .eq("user_id", user_id)
        .execute())
    return result.data[0] if result.data else None


def delete_shopping_item(user_id: str, item_id: int) -> bool:
    """Delete a single shopping item. Returns True if found and deleted."""
    supabase = get_supabase_client()
    result = (supabase.table("shopping_items")
        .delete()
        .eq("id", item_id)
        .eq("user_id", user_id)
        .execute())
    return bool(result.data)


def delete_checked_shopping_items(user_id: str) -> int:
    """Delete all checked shopping items for user. Returns count deleted."""
    supabase = get_supabase_client()
    result = (supabase.table("shopping_items")
        .delete()
        .eq("user_id", user_id)
        .eq("is_checked", True)
        .execute())
    return len(result.data or [])


def complete_shopping(
    user_id: str,
    item_ids: list[int],
    default_location: str = "Fridge",
) -> "CompleteShoppingResult":
    """
    Convert checked shopping items into inventory batches.
    For each item_id: fetch → build InventoryItemCreate → add_inventory_item → delete from shopping.
    """
    from schemas import InventoryItemCreate, CompleteShoppingResult

    supabase = get_supabase_client()
    added_count = 0
    failed_items: list[str] = []
    inventory_ids: list[int] = []

    for item_id in item_ids:
        result = (supabase.table("shopping_items")
            .select("*")
            .eq("id", item_id)
            .eq("user_id", user_id)
            .limit(1)
            .execute())
        if not result.data:
            continue

        row = result.data[0]
        try:
            inv_item = InventoryItemCreate(
                item_name=row["item_name"],
                brand=row.get("brand"),
                quantity=row.get("quantity") or 1.0,
                unit=row.get("unit") or "pcs",
                category=row.get("category"),
                location=default_location,
                total_volume=row.get("quantity") or 1.0,
                expiry_date=None,
            )
            new_batch = add_inventory_item(user_id=user_id, item=inv_item)
            inventory_ids.append(new_batch["id"])
            added_count += 1
            supabase.table("shopping_items").delete().eq("id", item_id).eq("user_id", user_id).execute()
        except Exception:
            failed_items.append(row["item_name"])

    return CompleteShoppingResult(
        added_count=added_count,
        failed_items=failed_items,
        inventory_ids=inventory_ids,
    )
