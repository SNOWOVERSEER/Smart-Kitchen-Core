"""Photo recognition service using multimodal AI."""

import json
from typing import Any

from langchain_core.messages import HumanMessage

from agent.llm_factory import get_user_llm


RECOGNITION_PROMPT = """You are a grocery recognition assistant for a kitchen inventory system.

Analyze this photo and identify ALL food/grocery items visible.

Return ONLY valid JSON (no markdown, no explanation):
{
    "items": [
        {
            "item_name": "English name (capitalized)",
            "brand": "brand name or null",
            "quantity": estimated_number,
            "unit": "L" | "kg" | "pcs",
            "category": "Dairy" | "Meat" | "Veg" | "Pantry" | null
        }
    ],
    "description": "Brief description of what you see in the user's language"
}

Rules:
- item_name MUST be in English, title case (e.g., "Whole Milk", "Chicken Breast")
- Standardize units: ml -> L (divide by 1000), g -> kg (divide by 1000)
- Estimate quantity from visible packaging (e.g., 1L bottle = quantity 1, unit L)
- If brand is visible on packaging, include it
- If quantity is not determinable, default to 1
- Maximum 10 items per photo
"""

# Image size limit: 4MB (base64 is ~33% larger than raw)
MAX_IMAGE_SIZE = 4 * 1024 * 1024


def recognize_image(user_id: str, image_base64: str) -> dict[str, Any]:
    """
    Recognize grocery items in a photo using the user's multimodal AI.

    Args:
        user_id: Authenticated user's UUID
        image_base64: Base64-encoded image (with or without data URI prefix)

    Returns:
        dict with 'items' (list of recognized items) and 'description' (text summary)

    Raises:
        ValueError: If image is too large or AI doesn't support vision
    """
    # Validate image size
    if len(image_base64) > MAX_IMAGE_SIZE:
        raise ValueError(
            "Image too large. Please compress to under 3MB before uploading."
        )

    # Ensure proper data URI format
    if not image_base64.startswith("data:image/"):
        image_base64 = f"data:image/jpeg;base64,{image_base64}"

    # Get user's LLM
    llm = get_user_llm(user_id)

    # Send multimodal message
    message = HumanMessage(
        content=[
            {"type": "text", "text": RECOGNITION_PROMPT},
            {"type": "image_url", "image_url": {"url": image_base64}},
        ]
    )

    try:
        response = llm.invoke([message])
    except Exception as e:
        error_str = str(e)
        if "vision" in error_str.lower() or "image" in error_str.lower():
            raise ValueError(
                "Your current AI model doesn't support image recognition. "
                "Please switch to a multimodal model (e.g., GPT-4o) in settings."
            ) from e
        raise

    # Parse response
    return _parse_recognition_response(response.content)


def _parse_recognition_response(content: str) -> dict[str, Any]:
    """Parse AI response into structured recognition result."""
    try:
        # Strip markdown code blocks if present
        text = content.strip()
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        result = json.loads(text.strip())
        items = result.get("items", [])
        description = result.get("description", "")

        # Validate and clean items
        cleaned = []
        for item in items[:10]:  # Max 10 items
            cleaned.append({
                "item_name": str(item.get("item_name", "Unknown")).strip().title(),
                "brand": item.get("brand"),
                "quantity": float(item.get("quantity", 1)),
                "unit": item.get("unit", "pcs"),
                "category": item.get("category"),
                "confidence": item.get("confidence", "medium"),
            })

        return {"items": cleaned, "description": description}

    except (json.JSONDecodeError, KeyError, TypeError):
        return {"items": [], "description": content}


def build_agent_text_from_items(items: list[dict]) -> str:
    """
    Convert recognized items into natural language text for the agent.

    Example output: "I bought 1L Milk (A2), 12pcs Eggs, 0.5kg Chicken Breast"
    """
    if not items:
        return ""

    parts = []
    for item in items:
        part = f"{item['quantity']}{item['unit']} {item['item_name']}"
        if item.get("brand"):
            part += f" ({item['brand']})"
        parts.append(part)

    return "I bought " + ", ".join(parts)
