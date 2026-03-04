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


# Common pantry staples — assumed available when user has assume_pantry_basics=True
PANTRY_STAPLES = [
    "salt", "pepper", "cooking oil", "olive oil", "sugar", "garlic",
    "onion", "soy sauce", "vinegar", "flour", "butter", "eggs",
    "water", "rice", "pasta",
]

# Categories that count as "real cooking ingredients" for feasibility check
COOKING_CATEGORIES = {"meat", "seafood", "vegetable", "fruit", "dairy", "grain", "legume"}

# Snack/beverage/condiment categories that don't count toward cooking feasibility
NON_COOKING_CATEGORIES = {"snack", "beverage", "condiment", "sauce"}


def _classify_prompt_mode(prompt: str | None) -> str:
    """Detect if the user is requesting a specific dish or exploring."""
    if not prompt:
        return "exploratory"
    words = prompt.strip().split()
    action_words = {"use", "make", "cook", "with", "using", "something", "suggest", "recommend", "any", "give"}
    if len(words) <= 6 and not any(w.lower() in action_words for w in words):
        return "specific_dish"
    return "exploratory"


def _check_inventory_feasibility(inventory: list[dict]) -> tuple[bool, list[str]]:
    """Check if inventory has enough real ingredients to cook with."""
    cooking_items = []
    for item in inventory:
        cat = (item.get("category") or "").lower()
        name = item.get("item_name", "")
        if cat in COOKING_CATEGORIES:
            cooking_items.append(name)
        elif cat not in NON_COOKING_CATEGORIES and cat:
            cooking_items.append(name)
    return len(set(cooking_items)) >= 3, cooking_items


def _get_user_taste_profile(user_id: str) -> list[str]:
    """Extract tag frequency from saved recipes to understand user preferences."""
    supabase = get_supabase_client()
    result = (supabase.table("saved_recipes")
              .select("tags")
              .eq("user_id", user_id)
              .order("created_at", desc=True)
              .limit(30)
              .execute())
    tag_counts: dict[str, int] = {}
    for row in (result.data or []):
        for tag in (row.get("tags") or []):
            if isinstance(tag, str):
                tag_counts[tag.lower()] = tag_counts.get(tag.lower(), 0) + 1
    return [tag for tag, _ in sorted(tag_counts.items(), key=lambda x: -x[1])[:5]]


def _get_assume_pantry_basics(user_id: str) -> bool:
    """Check if user has pantry basics assumption enabled."""
    supabase = get_supabase_client()
    result = (supabase.table("profiles")
              .select("assume_pantry_basics")
              .eq("id", user_id)
              .limit(1)
              .execute())
    if result.data:
        return result.data[0].get("assume_pantry_basics", True)
    return True


def generate_recipes(user_id: str, categories: list[str], use_expiring: bool, prompt: str | None) -> dict:
    """Generate recipe cards with smart mode detection and feasibility checking."""
    from schemas import RecipeCard
    from agent.llm_factory import get_user_llm
    from pydantic import BaseModel as _BaseModel

    class _Output(_BaseModel):
        recipes: list[RecipeCard]

    llm = get_user_llm(user_id)
    structured_llm = llm.with_structured_output(_Output)
    supabase = get_supabase_client()
    all_inv = [item for item in get_all_inventory(user_id) if (item.get("quantity") or 0) > 0]

    feasibility_notice: str | None = None

    # --- Mode detection ---
    prompt_mode = _classify_prompt_mode(prompt)

    # --- Expiring items handling ---
    if use_expiring:
        cutoff = (date.today() + timedelta(days=7)).isoformat()
        result = (supabase.table("inventory")
            .select("item_name, brand, quantity, unit, expiry_date, category")
            .eq("user_id", user_id).gt("quantity", 0)
            .lte("expiry_date", cutoff).not_.is_("expiry_date", "null")
            .order("expiry_date").limit(20).execute())
        expiring = result.data or []
        if expiring:
            inventory_items = expiring
        else:
            inventory_items = all_inv[:15]
    else:
        inventory_items = all_inv[:20]

    inventory_text = _format_inventory_for_prompt(inventory_items)

    # --- Feasibility check (only for exploratory mode without explicit prompt) ---
    is_feasible, cooking_items = _check_inventory_feasibility(inventory_items)
    taste_tags = _get_user_taste_profile(user_id)

    if not is_feasible and prompt_mode == "exploratory" and not prompt:
        taste_hint = f" Based on your cooking history, you enjoy: {', '.join(taste_tags)}." if taste_tags else ""
        feasibility_notice = (
            f"Your pantry is a bit light for full recipes right now — "
            f"here are suggestions you might enjoy that require minimal extra shopping.{taste_hint}"
        )

    # --- Pantry staples ---
    assume_basics = _get_assume_pantry_basics(user_id)
    staples_block = ""
    if assume_basics:
        staples_block = (
            "\n\nCommon staples (assume the user has these even if not listed above): "
            + ", ".join(PANTRY_STAPLES) + "."
        )

    # --- Build mode instruction ---
    if prompt_mode == "specific_dish" and prompt:
        mode_instruction = (
            f'The user wants: "{prompt}".\n'
            f"Recipe 1 MUST be this exact dish, prepared authentically.\n"
            f"Recipes 2-{RECIPES_PER_GENERATION} should be complementary dishes from the same "
            f"cuisine that pair well with it — sides, soups, appetizers, or desserts that "
            f"form a cohesive meal. Do NOT generate random unrelated recipes."
        )
    elif not is_feasible and not prompt:
        taste_str = f" The user enjoys: {', '.join(taste_tags)}." if taste_tags else ""
        mode_instruction = (
            f"The user's inventory is limited for cooking.{taste_str}\n"
            f"Suggest {RECIPES_PER_GENERATION} practical, real recipes the user would enjoy. "
            f"These should be simple dishes that use some of the available ingredients "
            f"and require minimal extra shopping. Clearly mark which ingredients are NOT in stock."
        )
    else:
        mode_instruction = f"Generate {RECIPES_PER_GENERATION} recipes using ingredients from this inventory."
        if use_expiring:
            mode_instruction = f"Prioritize using expiring items. " + mode_instruction

    if categories:
        mode_instruction += f"\nFocus on these styles/categories: {', '.join(categories)}."

    if prompt and prompt_mode == "exploratory":
        mode_instruction += f'\nUser request: "{prompt}"'

    # --- System prompt ---
    system_prompt = f"""You are a practical recipe assistant. Your goal is to suggest real,
delicious recipes that people actually cook.

{mode_instruction}

Available inventory:
{inventory_text}{staples_block}

Rules:
1. Every recipe MUST be a real dish from an established cuisine tradition, or a reasonable
   variation of one. Never invent implausible ingredient combinations.
2. Do NOT force incompatible ingredients together just because they are in stock.
   It is better to suggest a recipe that needs a few extra ingredients than to create
   something no one would eat.
3. Include ALL ingredients each recipe needs — not only ones in stock.
4. For each ingredient, set have_in_stock=true if a semantically matching item exists in
   the inventory above. Use culinary knowledge for matching: "ground pork" matches
   "pork mince", "chicken breast" matches "chicken".
5. instructions: numbered steps as separate strings.
6. cook_time_min: total time including prep.
7. tags: lowercase English only. E.g. ["quick", "vegetarian", "asian"].
8. All field values in English.
9. image_prompt: Write a vivid 1-sentence description for a professional food photo of
   this dish. Include cuisine style, lighting, and presentation details.
10. If the available ingredients are mostly snacks or non-cooking items, acknowledge this
    and suggest simple, practical recipes anyway — do not force bizarre combinations.
"""

    try:
        output: _Output = structured_llm.invoke(system_prompt)
        recipes = output.recipes

        # Post-process: make have_in_stock deterministic and unit-aware
        for recipe in recipes:
            for ingredient in recipe.ingredients:
                matched_items = [
                    item for item in all_inv
                    if _ingredient_matches_inventory_name(ingredient.name, item.get("item_name"))
                ]
                covered, ratio = _is_ingredient_covered_by_inventory(ingredient, matched_items)
                ingredient.have_in_stock = bool(ingredient.have_in_stock or covered)
                in_stock = ingredient.have_in_stock
                ingredient.coverage_ratio = ratio
                ingredient.batch_ids = [item["id"] for item in matched_items] if in_stock else []

        return {
            "recipes": [r.model_dump() for r in recipes],
            "feasibility_notice": feasibility_notice,
        }
    except Exception as exc:
        raise ValueError(f"Recipe generation failed: {exc}") from exc


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


# ── Meal services ──

def create_meal(user_id: str, data: "MealCreate") -> dict:
    """Create a meal and optionally link recipes to it."""
    supabase = get_supabase_client()
    meal_data = {
        "user_id": user_id,
        "name": data.name,
        "scheduled_date": data.scheduled_date.isoformat() if data.scheduled_date else None,
        "meal_type": data.meal_type,
        "notes": data.notes,
        "is_template": data.is_template,
    }
    result = supabase.table("meals").insert(meal_data).execute()
    meal = result.data[0]

    if data.recipe_ids:
        links = [
            {"meal_id": meal["id"], "recipe_id": rid, "sort_order": i}
            for i, rid in enumerate(data.recipe_ids)
        ]
        supabase.table("meal_recipes").insert(links).execute()

    return get_meal(user_id, meal["id"])


def get_meals(
    user_id: str,
    date_from: str | None = None,
    date_to: str | None = None,
    is_template: bool | None = None,
) -> list[dict]:
    """List user's meals with recipe summaries. Optionally filter by date range or template status."""
    supabase = get_supabase_client()
    query = (supabase.table("meals")
        .select("*, meal_recipes(recipe_id, sort_order, servings, saved_recipes(title, description, cook_time_min, servings, tags, image_url))")
        .eq("user_id", user_id)
        .order("created_at", desc=True))
    if is_template is not None:
        query = query.eq("is_template", is_template)
    if date_from:
        query = query.gte("scheduled_date", date_from)
    if date_to:
        query = query.lte("scheduled_date", date_to)
    result = query.execute()

    # For templates, annotate with instance_count
    if is_template:
        template_ids = [m["id"] for m in (result.data or [])]
        instance_counts: dict[int, int] = {}
        if template_ids:
            count_result = (supabase.table("meals")
                .select("template_id")
                .eq("user_id", user_id)
                .in_("template_id", template_ids)
                .execute())
            for row in (count_result.data or []):
                tid = row["template_id"]
                instance_counts[tid] = instance_counts.get(tid, 0) + 1
        return [_format_meal(m, instance_count=instance_counts.get(m["id"], 0)) for m in (result.data or [])]

    return [_format_meal(m) for m in (result.data or [])]


def get_meal(user_id: str, meal_id: int) -> dict | None:
    """Get a single meal with full recipe details."""
    supabase = get_supabase_client()
    result = (supabase.table("meals")
        .select("*, meal_recipes(recipe_id, sort_order, servings, saved_recipes(title, description, cook_time_min, servings, tags, image_url))")
        .eq("id", meal_id)
        .eq("user_id", user_id)
        .limit(1)
        .execute())
    if not result.data:
        return None
    return _format_meal(result.data[0])


def update_meal(user_id: str, meal_id: int, data: "MealUpdate") -> dict | None:
    """Update meal fields. Uses exclude_unset to allow setting fields to None."""
    supabase = get_supabase_client()
    updates = data.model_dump(exclude_unset=True)
    if "scheduled_date" in updates:
        sd = updates["scheduled_date"]
        updates["scheduled_date"] = sd.isoformat() if sd else None
    if not updates:
        return get_meal(user_id, meal_id)
    result = (supabase.table("meals")
        .update(updates)
        .eq("id", meal_id)
        .eq("user_id", user_id)
        .execute())
    if not result.data:
        return None
    return get_meal(user_id, meal_id)


def delete_meal(user_id: str, meal_id: int) -> bool:
    """Delete meal. Cascade deletes meal_recipes."""
    supabase = get_supabase_client()
    result = (supabase.table("meals")
        .delete()
        .eq("id", meal_id)
        .eq("user_id", user_id)
        .execute())
    return bool(result.data)


def add_recipes_to_meal(user_id: str, meal_id: int, recipe_ids: list[int]) -> dict | None:
    """Add recipes to a meal. Skips duplicates."""
    supabase = get_supabase_client()
    meal = get_meal(user_id, meal_id)
    if not meal:
        return None
    existing = {r["recipe_id"] for r in meal.get("recipes", [])}
    max_order = max((r["sort_order"] for r in meal.get("recipes", [])), default=-1)
    new_links = []
    for i, rid in enumerate(recipe_ids):
        if rid not in existing:
            new_links.append({"meal_id": meal_id, "recipe_id": rid, "sort_order": max_order + 1 + i})
    if new_links:
        supabase.table("meal_recipes").insert(new_links).execute()
    return get_meal(user_id, meal_id)


def remove_recipe_from_meal(user_id: str, meal_id: int, recipe_id: int) -> dict | None:
    """Remove a recipe from a meal."""
    supabase = get_supabase_client()
    meal = get_meal(user_id, meal_id)
    if not meal:
        return None
    supabase.table("meal_recipes").delete().eq("meal_id", meal_id).eq("recipe_id", recipe_id).execute()
    return get_meal(user_id, meal_id)


def instantiate_meal(user_id: str, template_id: int, scheduled_date: str, meal_type: str | None = None, name: str | None = None) -> dict | None:
    """Create a meal instance from a template, copying its recipes."""
    supabase = get_supabase_client()
    # Fetch template
    template = get_meal(user_id, template_id)
    if not template or not template.get("is_template"):
        return None

    # Create instance
    instance_data = {
        "user_id": user_id,
        "name": name or template["name"],
        "scheduled_date": scheduled_date,
        "meal_type": meal_type or template.get("meal_type"),
        "notes": template.get("notes"),
        "is_template": False,
        "template_id": template_id,
    }
    result = supabase.table("meals").insert(instance_data).execute()
    instance = result.data[0]

    # Copy recipe links from template
    template_recipes = template.get("recipes", [])
    if template_recipes:
        links = [
            {"meal_id": instance["id"], "recipe_id": r["recipe_id"], "sort_order": r.get("sort_order", i)}
            for i, r in enumerate(template_recipes)
        ]
        supabase.table("meal_recipes").insert(links).execute()

    return get_meal(user_id, instance["id"])


def _format_meal(raw: dict, instance_count: int | None = None) -> dict:
    """Format a raw meal row with joined meal_recipes into MealResponse shape."""
    recipes = []
    for mr in sorted(raw.get("meal_recipes", []), key=lambda x: x.get("sort_order", 0)):
        sr = mr.get("saved_recipes") or {}
        recipes.append({
            "recipe_id": mr["recipe_id"],
            "title": sr.get("title", ""),
            "description": sr.get("description"),
            "cook_time_min": sr.get("cook_time_min"),
            "servings": mr.get("servings") or sr.get("servings"),
            "tags": sr.get("tags", []),
            "image_url": sr.get("image_url"),
            "sort_order": mr.get("sort_order", 0),
        })
    return {
        "id": raw["id"],
        "name": raw["name"],
        "scheduled_date": raw.get("scheduled_date"),
        "meal_type": raw.get("meal_type"),
        "notes": raw.get("notes"),
        "is_template": raw.get("is_template", False),
        "template_id": raw.get("template_id"),
        "instance_count": instance_count,
        "recipes": recipes,
        "created_at": raw["created_at"],
        "updated_at": raw["updated_at"],
    }
