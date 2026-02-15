"""Barcode lookup service using OpenFoodFacts API."""

import re
from typing import Any

from openfoodfacts import API, APIVersion, Country, Environment, Flavor


# Singleton API client
_api = API(
    user_agent="SmartKitchen/1.0",
    country=Country.world,
    flavor=Flavor.off,
    version=APIVersion.v2,
    environment=Environment.org,
)

# Map OFF categories to our category enum
CATEGORY_MAP = {
    "dairy": "Dairy",
    "milk": "Dairy",
    "cheese": "Dairy",
    "yogurt": "Dairy",
    "meat": "Meat",
    "poultry": "Meat",
    "chicken": "Meat",
    "beef": "Meat",
    "pork": "Meat",
    "fish": "Meat",
    "seafood": "Meat",
    "vegetable": "Veg",
    "fruit": "Veg",
    "bread": "Pantry",
    "cereal": "Pantry",
    "pasta": "Pantry",
    "rice": "Pantry",
    "snack": "Pantry",
    "beverage": "Pantry",
    "drink": "Pantry",
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
    """Parse unit from OFF quantity string like '1L', '500ml', '200g'."""
    if not quantity_str:
        return "pcs"

    q = quantity_str.lower().strip()
    if re.search(r"\d\s*(ml|cl|l)\b", q):
        return "L"
    if re.search(r"\d\s*(kg|g)\b", q):
        return "kg"
    return "pcs"


def _parse_quantity(quantity_str: str) -> float | None:
    """Parse numeric quantity from OFF string, standardized to L/kg."""
    if not quantity_str:
        return None

    q = quantity_str.lower().strip()

    match = re.search(r"([\d.]+)\s*(ml|cl|l|g|kg|pcs|pieces?|units?)", q)
    if not match:
        return None

    value = float(match.group(1))
    unit = match.group(2)

    if unit == "ml":
        return round(value / 1000, 3)
    if unit == "cl":
        return round(value / 100, 3)
    if unit == "g":
        return round(value / 1000, 3)
    return value
