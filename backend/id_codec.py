"""Encode / decode BigInt database IDs to short, prefixed strings.

Uses Sqids to produce URL-safe, deterministic short IDs at the API boundary.
The database continues to use BigInt PKs internally — this module only
transforms IDs when data enters or leaves the application layer.

Example: BigInt 42 → "inv_86Rf07xd" (inventory), "rcp_QRgqJvO8" (recipe)
"""

from __future__ import annotations

from sqids import Sqids

_sqids = Sqids(min_length=8)

# Entity type constants
INVENTORY = "inventory"
RECIPE = "recipe"
MEAL = "meal"
SHOPPING = "shopping"
LOG = "log"

_PREFIXES: dict[str, str] = {
    INVENTORY: "inv_",
    RECIPE: "rcp_",
    MEAL: "meal_",
    SHOPPING: "shp_",
    LOG: "log_",
}

_PREFIX_TO_ENTITY = {v: k for k, v in _PREFIXES.items()}


def encode_id(entity: str, id_val: int) -> str:
    """Encode a BigInt ID to a prefixed short string."""
    prefix = _PREFIXES[entity]
    return prefix + _sqids.encode([id_val])


def decode_id(prefixed_id: str) -> int:
    """Decode a prefixed short string back to a BigInt ID."""
    for prefix in _PREFIX_TO_ENTITY:
        if prefixed_id.startswith(prefix):
            raw = prefixed_id[len(prefix):]
            ids = _sqids.decode(raw)
            if not ids:
                raise ValueError(f"Invalid encoded ID: {prefixed_id}")
            return ids[0]
    raise ValueError(f"Unknown ID prefix in: {prefixed_id}")


def decode_or_int(value: str | int) -> int:
    """Decode if string, pass through if already int.

    Useful for backward compatibility with old agent checkpoint data
    that may contain integer IDs.
    """
    if isinstance(value, int):
        return value
    # Try parsing as plain integer first (legacy data)
    try:
        return int(value)
    except ValueError:
        pass
    return decode_id(value)


# ── Row-level encoding helpers ──


def encode_inventory_row(row: dict) -> dict:
    """Encode inventory batch IDs in a response dict."""
    row = dict(row)
    if "id" in row and isinstance(row["id"], int):
        row["id"] = encode_id(INVENTORY, row["id"])
    return row


def encode_recipe_row(row: dict) -> dict:
    """Encode recipe IDs (and nested batch_ids in ingredients)."""
    row = dict(row)
    if "id" in row and isinstance(row["id"], int):
        row["id"] = encode_id(RECIPE, row["id"])
    # Encode batch_ids inside ingredients
    if "ingredients" in row and isinstance(row["ingredients"], list):
        encoded_ings = []
        for ing in row["ingredients"]:
            if isinstance(ing, dict) and "batch_ids" in ing:
                ing = dict(ing)
                ing["batch_ids"] = [
                    encode_id(INVENTORY, bid) if isinstance(bid, int) else bid
                    for bid in ing["batch_ids"]
                ]
            encoded_ings.append(ing)
        row["ingredients"] = encoded_ings
    return row


def encode_meal_row(row: dict) -> dict:
    """Encode meal IDs, template_id, and nested recipe_ids."""
    row = dict(row)
    if "id" in row and isinstance(row["id"], int):
        row["id"] = encode_id(MEAL, row["id"])
    if row.get("template_id") is not None and isinstance(row["template_id"], int):
        row["template_id"] = encode_id(MEAL, row["template_id"])
    # Encode recipe_id in nested recipes
    if "recipes" in row and isinstance(row["recipes"], list):
        encoded_recipes = []
        for r in row["recipes"]:
            if isinstance(r, dict) and "recipe_id" in r and isinstance(r["recipe_id"], int):
                r = dict(r)
                r["recipe_id"] = encode_id(RECIPE, r["recipe_id"])
            encoded_recipes.append(r)
        row["recipes"] = encoded_recipes
    return row


def encode_shopping_row(row: dict) -> dict:
    """Encode shopping item IDs and source_recipe_id."""
    row = dict(row)
    if "id" in row and isinstance(row["id"], int):
        row["id"] = encode_id(SHOPPING, row["id"])
    if row.get("source_recipe_id") is not None and isinstance(row["source_recipe_id"], int):
        row["source_recipe_id"] = encode_id(RECIPE, row["source_recipe_id"])
    return row


def encode_log_row(row: dict) -> dict:
    """Encode transaction log IDs."""
    row = dict(row)
    if "id" in row and isinstance(row["id"], int):
        row["id"] = encode_id(LOG, row["id"])
    return row
