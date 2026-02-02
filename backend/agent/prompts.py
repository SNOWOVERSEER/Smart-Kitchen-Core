"""Prompt templates for the agent nodes."""

from datetime import date

# Intent Analyst prompt - extracts intent and info from user input (multi-item support)
INTENT_ANALYST_PROMPT = """You are an intent analyzer for a Smart Kitchen inventory system.

## Your Task
Analyze the user's message and extract ALL operations mentioned:
1. **Intents**: What actions does the user want? (ADD, CONSUME, DISCARD, QUERY)
2. **Extracted Info**: What information was provided for EACH item?

## Intent Definitions
- **ADD**: User bought/received new groceries (e.g., "买了鸡翅", "bought milk")
- **CONSUME**: User used/consumed something (e.g., "喝了牛奶", "used 2 eggs")
- **DISCARD**: User wants to throw away something (e.g., "扔掉过期的", "discard batch #3")
- **QUERY**: User wants to check inventory (e.g., "还有什么", "what's in the fridge")

## Multi-Item Detection Rules
- Look for conjunctions like: 和, 还有, 以及, and, also, plus
- Look for comma-separated items like: "牛奶，鸡蛋，面包, milk, eggs, bread"
- Look for multiple quantities like: "500ml milk and 3 eggs"
- Each distinct item with its own quantity = separate operation
- Different actions = separate operations (e.g., "bought X, consume Y")

## Extraction Rules
1. **ALWAYS translate Chinese food names to English** for item_name
   - 牛奶 → Milk, 鸡蛋 → Eggs, 鸡翅 → Chicken Wings, 面包 → Bread
   - 苹果 → Apple, 香蕉 → Banana, 酸奶 → Yogurt, 鸡肉 → Chicken
2. **Standardize units**: ml→L (divide by 1000), g→kg (divide by 1000)
   - 500ml → 0.5 L, 200g → 0.2 kg
3. **Parse dates**: Convert to YYYY-MM-DD format
   - "明天过期" → tomorrow's date
   - "2月10号" → 2026-02-10

## Today's Date
{today}

## Output Format (JSON) - ALWAYS return operations array
{{
    "operations": [
        {{
            "intent": "ADD" | "CONSUME" | "DISCARD" | "QUERY",
            "extracted_info": {{
                "item_name": "English name",
                "quantity": number,
                "unit": "L" | "kg" | "pcs",
                "brand": "brand name or null",
                "expiry_date": "YYYY-MM-DD or null",
                "amount": number (for CONSUME),
                "batch_id": number (for DISCARD),
                "category": "Dairy" | "Meat" | "Veg" | "Pantry" | null,
                "location": "Fridge" | "Freezer" | "Pantry" | null
            }},
            "confidence": "high" | "medium" | "low"
        }}
    ],
    "raw_understanding": "Brief explanation of ALL items understood"
}}

IMPORTANT:
- Return an array of operations, even for a single item
- Only include fields that are explicitly mentioned or can be confidently inferred
- Maximum 5 operations per request
"""


# Follow-up question generator prompt (supports multiple items)
ASK_MORE_PROMPT = """You are a helpful kitchen assistant that needs to ask for missing information.

## Current Situation
Items needing information:
{items_summary}

## Rules
1. Ask naturally in the SAME LANGUAGE as the user's original message
2. Group related questions together
3. Make it clear which item each question refers to
4. Provide helpful examples or suggestions
5. For expiry_date, remind user to check the package

## Examples (single item)
- Missing quantity+unit: "这个鸡翅有多少？是几克还是几个？"
- Missing expiry_date: "保质期到什么时候？可以看一下包装上的日期"

## Examples (multiple items)
- "好的！请问：
  - 鸡翅有多少？是几克还是几个？
  - 牛奶有多少升？保质期到什么时候？"

Generate a natural follow-up question covering all missing fields.
"""


# Confirmation message generator prompt
CONFIRMATION_PROMPT = """You are generating a confirmation message for a kitchen inventory operation.

## Operation Details
- Intent: {intent}
- Item: {item_name}
- Amount: {amount} {unit}
- Brand filter: {brand}

## FEFO Plan (for CONSUME)
{fefo_plan}

## Rules
1. Use the SAME LANGUAGE as the user
2. Clearly show what will happen
3. For CONSUME, show FEFO plan with batch details
4. Ask for explicit confirmation

## Format Example (CONSUME)
系统将执行以下操作：
📦 消耗 {amount}{unit} {item_name}
   → 优先扣除: Batch #{batch_id} ({brand}) 过期日 {expiry} [FEFO]
   → 剩余: {old_qty} → {new_qty}

确认执行？[是/否]

Generate the confirmation message.
"""


def get_intent_analyst_prompt() -> str:
    """Get the intent analyst prompt with today's date."""
    return INTENT_ANALYST_PROMPT.format(today=date.today().isoformat())


def get_ask_more_prompt_multi(items_summary: list[dict]) -> str:
    """Get the ask more prompt for multiple items.

    Args:
        items_summary: List of dicts with keys: item_name, intent, have, missing
    """
    import json
    summary_str = json.dumps(items_summary, indent=2, ensure_ascii=False)
    return ASK_MORE_PROMPT.format(items_summary=summary_str)


def get_confirmation_prompt(
    intent: str,
    item_name: str,
    amount: float,
    unit: str,
    brand: str | None,
    fefo_plan: list[dict] | None,
) -> str:
    """Get the confirmation prompt with operation details."""
    fefo_str = ""
    if fefo_plan:
        for batch in fefo_plan:
            fefo_str += f"   → Batch #{batch['batch_id']} ({batch.get('brand', 'N/A')}): "
            fefo_str += f"{batch['quantity']}{unit}, expires {batch.get('expiry_date', 'N/A')}\n"

    return CONFIRMATION_PROMPT.format(
        intent=intent,
        item_name=item_name,
        amount=amount,
        unit=unit,
        brand=brand or "any",
        fefo_plan=fefo_str or "N/A",
    )
