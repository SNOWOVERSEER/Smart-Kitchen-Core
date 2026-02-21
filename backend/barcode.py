"""Barcode lookup service using OpenFoodFacts API."""

import re
from typing import Any

from openfoodfacts import API, APIVersion, Country, Environment, Flavor


# Singleton API client
_api = API(
    user_agent="KitchenLoop/1.0",
    country=Country.world,
    flavor=Flavor.off,
    version=APIVersion.v2,
    environment=Environment.org,
)

# Map OFF categories to our category enum.
# Keys are substrings matched against OFF tag slugs (case-insensitive).
CATEGORY_MAP = {
    # Dairy
    "dairy": "Dairy",
    "milk": "Dairy",
    "cheese": "Dairy",
    "yogurt": "Dairy",
    "butter": "Dairy",
    "cream": "Dairy",
    # Meat / seafood
    "meat": "Meat",
    "poultry": "Meat",
    "chicken": "Meat",
    "beef": "Meat",
    "pork": "Meat",
    "fish": "Meat",
    "seafood": "Meat",
    # Produce
    "vegetable": "Vegetable",
    "vegetal": "Vegetable",   # OFF uses French-influenced slugs
    "fruit": "Fruit",
    # Beverages — must come before generic pantry keywords
    "beverage": "Beverage",
    "drink": "Beverage",
    "juice": "Beverage",
    "water": "Beverage",
    "soda": "Beverage",
    "cola": "Beverage",
    "coffee": "Beverage",
    "tea": "Beverage",
    "beer": "Beverage",
    "wine": "Beverage",
    # Snacks
    "snack": "Snack",
    "chip": "Snack",
    "crisp": "Snack",
    "biscuit": "Snack",
    "cookie": "Snack",
    "chocolate": "Snack",
    "candy": "Snack",
    "sweet": "Snack",
    "popcorn": "Snack",
    "cracker": "Snack",
    # Pantry / dry goods
    "bread": "Pantry",
    "cereal": "Pantry",
    "pasta": "Pantry",
    "rice": "Pantry",
    "flour": "Pantry",
    "sauce": "Pantry",
    "oil": "Pantry",
    "spice": "Pantry",
    "condiment": "Pantry",
    "vinegar": "Pantry",
    "sugar": "Pantry",
    "salt": "Pantry",
}


def lookup_barcode(barcode: str) -> dict[str, Any] | None:
    """
    Look up a product by barcode using OpenFoodFacts API.

    Returns standardized product info dict, or None if not found.
    """
    try:
        result = _api.product.get(
            barcode,
            fields=["product_name", "brands", "categories_tags", "quantity", "image_url"],
        )
    except Exception:
        return None

    if not result or not result.get("product_name"):
        return None

    return {
        "item_name": _clean_product_name(result.get("product_name", "")),
        "brand": _extract_brand(result.get("brands", "")),
        "category": _map_category(result.get("categories_tags", [])),
        "unit": _parse_unit(result.get("quantity", "")),
        "default_quantity": _parse_quantity(result.get("quantity", "")),
        "image_url": result.get("image_url"),
    }


def _clean_product_name(name: str) -> str:
    """Clean and capitalize product name."""
    if not name:
        return ""
    return name.split(",")[0].strip().title()


def _extract_brand(brands: str) -> str | None:
    """Extract primary brand name."""
    if not brands:
        return None
    return brands.split(",")[0].strip().title()


def _map_category(tags: list[str]) -> str | None:
    """Map OpenFoodFacts category tags to our category enum."""
    for tag in tags:
        clean = tag.split(":")[-1].lower().replace("-", " ")
        for keyword, category in CATEGORY_MAP.items():
            if keyword in clean:
                return category
    return None


def _parse_unit(quantity_str: str) -> str:
    """Parse unit from OFF quantity string like '1L', '500ml', '200g', '1.5kg'.

    Liquids (ml/cl/L) → "L"
    Grams → "g"
    Kilograms → "kg"
    Everything else → "pcs"
    """
    if not quantity_str:
        return "pcs"

    q = quantity_str.lower().strip()
    if re.search(r"[\d.]\s*(ml|cl|l)\b", q):
        return "L"
    if re.search(r"[\d.]\s*kg\b", q):
        return "kg"
    if re.search(r"[\d.]\s*g\b", q):
        return "g"
    return "pcs"


def _parse_quantity(quantity_str: str) -> float | None:
    """Parse numeric quantity from OFF string.

    Liquids are converted to L (ml/cl → L).
    Solid weights keep their natural unit (g stays g, kg stays kg).
    """
    if not quantity_str:
        return None

    q = quantity_str.lower().strip()

    match = re.search(r"([\d.]+)\s*(ml|cl|l|g|kg|pcs|pieces?|units?)", q)
    if not match:
        return None

    value = float(match.group(1))
    unit = match.group(2)

    if unit == "ml":
        return round(value / 1000, 3)   # 500ml → 0.5 L
    if unit == "cl":
        return round(value / 100, 3)    # 33cl → 0.33 L
    # g, kg, l, pcs — keep as-is
    return value
