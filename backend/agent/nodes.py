"""Node implementations for the LangGraph agent."""

import json
import os
from datetime import date
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from sqlmodel import Session

from agent.prompts import (
    get_intent_analyst_prompt,
    get_ask_more_prompt_multi,
)
from agent.state import AgentState, PendingAction, PendingActionItem, REQUIRED_FIELDS
from database import engine
from services import consume_item, add_inventory_item, discard_batch, get_inventory_grouped
from schemas import InventoryItemCreate


def get_llm() -> ChatOpenAI:
    """Get the LLM instance."""
    return ChatOpenAI(
        model="gpt-4o",
        temperature=0,
        api_key=os.getenv("OPENAI_API_KEY"),
    )


def log_node(node_name: str, input_state: dict, output: dict) -> None:
    """Log node execution for observability."""
    print(f"\n{'='*50}")
    print(f"[NODE: {node_name}]")
    print(f"[INPUT] status={input_state.get('status')}, pending={input_state.get('pending_action')}")
    print(f"[OUTPUT] {output}")
    print(f"{'='*50}\n")


# ============ Node 1: Intent Analyst ============

def intent_analyst(state: AgentState) -> dict:
    """
    Analyze user input to extract intent and information.
    First node in the graph.
    """
    messages = state.get("messages", [])
    if not messages:
        return {"status": "completed", "response": "No input received."}

    # Get the last user message
    last_message = messages[-1]
    user_input = last_message.content if hasattr(last_message, "content") else str(last_message)

    # Check if this is a confirmation response
    if state.get("status") == "awaiting_confirm":
        return handle_confirmation_response(state, user_input)

    # Check if this is a follow-up with more info
    if state.get("status") == "awaiting_info" and state.get("pending_action"):
        return handle_additional_info(state, user_input)

    # Fresh intent analysis
    llm = get_llm()
    system_prompt = get_intent_analyst_prompt()

    response = llm.invoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Analyze this message: {user_input}"),
    ])

    # Parse the response
    try:
        # Extract JSON from response
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]

        analysis = json.loads(content.strip())
    except (json.JSONDecodeError, IndexError):
        print(f"[WARN] Failed to parse intent analysis: {response.content}")
        analysis = {
            "operations": [{"intent": "QUERY", "extracted_info": {}}],
            "raw_understanding": "Could not parse user input",
        }

    # Handle operations array (multi-item support)
    operations = analysis.get("operations", [])
    if not operations:
        # Backward compatibility: single item format
        operations = [{
            "intent": analysis.get("intent", "QUERY"),
            "extracted_info": analysis.get("extracted_info", {}),
        }]

    # Build items list from operations
    items: list[PendingActionItem] = []
    for idx, op in enumerate(operations[:5]):  # Max 5 items
        items.append({
            "index": idx,
            "intent": op.get("intent", "QUERY"),
            "extracted_info": op.get("extracted_info", {}),
            "missing_fields": [],
            "fefo_plan": [],
        })

    # Create pending action with items
    pending_action: PendingAction = {
        "items": items,
        "needs_confirmation": False,
        "confirmation_message": "",
        "all_complete": False,
    }

    output = {
        "pending_action": pending_action,
        "status": "processing",
    }

    log_node("Intent_Analyst", state, output)
    return output


def handle_confirmation_response(state: AgentState, user_input: str) -> dict:
    """Handle user's confirmation response (yes/no)."""
    user_input_lower = user_input.lower().strip()

    pending = state.get("pending_action")
    messages = state.get("messages", [])
    user_lang = detect_language(messages)

    # Check for EXPLICIT confirmation/cancellation patterns
    # These are checked first as they're unambiguous
    explicit_confirm = ["confirm", "确认", "确定", "执行"]
    explicit_cancel = ["cancel", "取消", "算了", "不要了", "不执行"]

    # Check explicit patterns first (higher priority)
    if any(p == user_input_lower or user_input_lower.startswith(p) for p in explicit_confirm):
        return {"pending_action": pending, "status": "confirmed"}
    if any(n == user_input_lower or user_input_lower.startswith(n) for n in explicit_cancel):
        cancel_msg = "好的，已取消操作。还有什么需要帮忙的吗？" if user_lang == "zh" else "OK, operation cancelled. Anything else I can help with?"
        return {"pending_action": None, "status": "completed", "response": cancel_msg}

    # Check for negation patterns (must check BEFORE simple positive patterns)
    # "不对" (wrong), "不是" (not that), "不行" (no way) indicate rejection or correction
    negation_patterns = ["不对", "不是", "不行", "错了", "wrong", "not right", "wait"]
    if any(neg in user_input_lower for neg in negation_patterns):
        # User is correcting - treat as modification request, not simple cancel
        # For now, cancel and ask them to try again with correct info
        correction_msg = "好的，已取消。请重新告诉我正确的操作。" if user_lang == "zh" else "OK, cancelled. Please tell me the correct operation."
        return {"pending_action": None, "status": "completed", "response": correction_msg}

    # Simple yes/no patterns (lower priority)
    simple_yes = ["yes", "y", "ok", "是", "好", "可以", "行", "嗯", "对"]
    simple_no = ["no", "n", "否", "不"]

    # For simple patterns, require them to be standalone or at start
    for yes in simple_yes:
        if user_input_lower == yes or user_input_lower.startswith(yes + " "):
            return {"pending_action": pending, "status": "confirmed"}

    for no in simple_no:
        if user_input_lower == no or user_input_lower.startswith(no + " "):
            cancel_msg = "好的，已取消操作。还有什么需要帮忙的吗？" if user_lang == "zh" else "OK, operation cancelled. Anything else I can help with?"
            return {"pending_action": None, "status": "completed", "response": cancel_msg}

    # Unclear response - ask again
    retry_msg = "请确认是否执行？回复'确认'或'取消'" if user_lang == "zh" else "Please confirm: reply 'yes' or 'no'"
    return {"pending_action": pending, "status": "awaiting_confirm", "response": retry_msg}


def handle_additional_info(state: AgentState, user_input: str) -> dict:
    """Handle additional info provided by user for slot filling (multi-item support)."""
    pending = state.get("pending_action", {})
    items = pending.get("items", [])

    # Collect all missing fields with item context
    all_missing = []
    for item in items:
        for field in item.get("missing_fields", []):
            all_missing.append({
                "index": item["index"],
                "item_name": item["extracted_info"].get("item_name", "unknown"),
                "intent": item["intent"],
                "field": field,
            })

    # Use LLM to extract additional info for all items
    llm = get_llm()
    items_context = json.dumps([{
        "index": i["index"],
        "item": i["extracted_info"].get("item_name", "unknown"),
        "intent": i["intent"],
        "have": i["extracted_info"],
        "missing": i["missing_fields"],
    } for i in items if i.get("missing_fields")], ensure_ascii=False)

    prompt = f"""The user is providing additional information for multiple items.

Items needing info:
{items_context}

User's response: {user_input}

Extract new information and map to correct items. Return JSON:
{{
    "updates": [
        {{"index": 0, "quantity": 0.5, "unit": "kg", "expiry_date": "2024-02-20"}},
        {{"index": 1, "quantity": 10, "unit": "pcs"}}
    ]
}}

IMPORTANT: Use actual field names as keys (quantity, unit, expiry_date, brand, etc.), NOT "field_name".
Only include fields that the user actually provided.

Remember:
- Translate Chinese food names to English
- Convert units: ml→L (÷1000), g→kg (÷1000)
- Dates in YYYY-MM-DD format
- Match info to the correct item by context
"""

    response = llm.invoke([HumanMessage(content=prompt)])

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        result = json.loads(content.strip())
        updates = result.get("updates", [])
    except (json.JSONDecodeError, IndexError):
        updates = []

    # Apply updates to correct items
    for update in updates:
        idx = update.pop("index", 0)
        if idx < len(items):
            items[idx]["extracted_info"].update(update)
            items[idx]["missing_fields"] = get_missing_fields(
                items[idx]["intent"],
                items[idx]["extracted_info"]
            )

    pending["items"] = items

    return {
        "pending_action": pending,
        "status": "processing",
    }


# ============ Node 2: Information Validator ============

def information_validator(state: AgentState) -> dict:
    """
    Validate extracted information and decide next step (multi-item support).
    Routes to: ask_more, confirm, or execute.
    """
    pending = state.get("pending_action")
    if not pending:
        output = {"status": "completed", "response": "No action pending."}
        log_node("Information_Validator", state, output)
        return output

    items = pending.get("items", [])
    if not items:
        output = {"status": "completed", "response": "No items to process."}
        log_node("Information_Validator", state, output)
        return output

    # Check missing fields for ALL items
    all_complete = True
    needs_confirmation = False

    for item in items:
        missing = get_missing_fields(item["intent"], item["extracted_info"])
        item["missing_fields"] = missing

        if missing:
            all_complete = False

        if item["intent"] in ["CONSUME", "DISCARD"]:
            needs_confirmation = True

    pending["all_complete"] = all_complete
    pending["items"] = items

    if not all_complete:
        # Need more info for some items
        output = {
            "pending_action": pending,
            "status": "awaiting_info",
            "next": "ask_more",
        }
    elif needs_confirmation:
        # Need confirmation for write operations
        output = {
            "pending_action": pending,
            "status": "processing",
            "next": "confirm",
        }
    else:
        # Can execute directly (QUERY, ADD with all info)
        output = {
            "pending_action": pending,
            "status": "processing",
            "next": "execute",
        }

    log_node("Information_Validator", state, output)
    return output


def get_missing_fields(intent: str, extracted: dict) -> list[str]:
    """Get list of missing required fields for an intent."""
    required = REQUIRED_FIELDS.get(intent, [])
    missing = []

    for field in required:
        if field not in extracted or extracted[field] is None:
            # Special case: DISCARD can use item_name instead of batch_id
            if field == "batch_id" and "item_name" in extracted:
                continue
            missing.append(field)

    return missing


# ============ Node 3: Ask More ============

def ask_more(state: AgentState) -> dict:
    """
    Generate follow-up question for missing information (multi-item support).
    """
    pending = state.get("pending_action", {})
    items = pending.get("items", [])

    # Build summary of items needing info
    items_summary = []
    for item in items:
        if item.get("missing_fields"):
            items_summary.append({
                "item_name": item["extracted_info"].get("item_name", "unknown"),
                "intent": item["intent"],
                "have": item["extracted_info"],
                "missing": item["missing_fields"],
            })

    # Get the original user language from messages
    messages = state.get("messages", [])
    user_lang = detect_language(messages)

    llm = get_llm()
    prompt = get_ask_more_prompt_multi(items_summary)

    # Add language hint
    lang_hint = "Respond in Chinese." if user_lang == "zh" else "Respond in English."

    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=f"{lang_hint}\nGenerate a natural follow-up question for all missing fields."),
    ])

    output = {
        "pending_action": pending,
        "status": "awaiting_info",
        "response": response.content,
    }

    log_node("Ask_More", state, output)
    return output


def detect_language(messages: list) -> str:
    """Detect if user is speaking Chinese or English."""
    for msg in reversed(messages):
        content = msg.content if hasattr(msg, "content") else str(msg)
        # Simple heuristic: check for Chinese characters
        if any("\u4e00" <= char <= "\u9fff" for char in content):
            return "zh"
    return "en"


# ============ Node 4: Confirm ============

def confirm(state: AgentState) -> dict:
    """
    Generate confirmation message and prepare FEFO plan (multi-item support).
    This node uses interrupt_before to pause for user confirmation.
    """
    pending = state.get("pending_action", {})
    items = pending.get("items", [])

    messages = state.get("messages", [])
    user_lang = detect_language(messages)

    # Calculate FEFO plan for all CONSUME items
    for item in items:
        if item["intent"] == "CONSUME":
            item["fefo_plan"] = calculate_fefo_plan(
                item_name=item["extracted_info"].get("item_name", ""),
                amount=item["extracted_info"].get("amount", 0),
                brand=item["extracted_info"].get("brand"),
            )

    # Build multi-item confirmation message
    if user_lang == "zh":
        msg = "系统将执行以下操作：\n\n"
        for i, item in enumerate(items, 1):
            msg += build_item_confirmation_zh(i, item)
        msg += "\n确认执行所有操作？[是/否]"
    else:
        msg = "System will execute:\n\n"
        for i, item in enumerate(items, 1):
            msg += build_item_confirmation_en(i, item)
        msg += "\nConfirm all operations? [Yes/No]"

    pending["confirmation_message"] = msg
    pending["items"] = items

    output = {
        "pending_action": pending,
        "status": "awaiting_confirm",
        "response": msg,
    }

    log_node("Confirm", state, output)
    return output


def build_item_confirmation_zh(num: int, item: dict) -> str:
    """Build Chinese confirmation for single item."""
    intent = item["intent"]
    info = item["extracted_info"]

    emoji = {"ADD": "📥", "CONSUME": "📦", "DISCARD": "🗑️", "QUERY": "🔍"}
    action = {"ADD": "添加", "CONSUME": "消耗", "DISCARD": "丢弃", "QUERY": "查询"}

    msg = f"{num}️⃣ {emoji.get(intent, '')} {action.get(intent, '')} "

    if intent == "CONSUME":
        msg += f"{info.get('amount', 0)}{info.get('unit', '')} {info.get('item_name', '')}\n"
        for batch in item.get("fefo_plan", []):
            brand_str = f" ({batch.get('brand')})" if batch.get("brand") else ""
            msg += f"   → Batch #{batch['batch_id']}{brand_str}, "
            msg += f"过期 {batch.get('expiry_date', 'N/A')}, "
            msg += f"扣除 {batch['deduct_amount']}\n"
    elif intent == "ADD":
        msg += f"{info.get('quantity', 0)}{info.get('unit', '')} {info.get('item_name', '')}"
        if info.get("expiry_date"):
            msg += f", 过期日 {info['expiry_date']}"
        msg += "\n"
    elif intent == "DISCARD":
        msg += f"批次 #{info.get('batch_id', '?')}\n"
    else:
        msg += f"{info.get('item_name', 'all')}\n"

    return msg + "\n"


def build_item_confirmation_en(num: int, item: dict) -> str:
    """Build English confirmation for single item."""
    intent = item["intent"]
    info = item["extracted_info"]

    emoji = {"ADD": "📥", "CONSUME": "📦", "DISCARD": "🗑️", "QUERY": "🔍"}

    msg = f"{num}️⃣ {emoji.get(intent, '')} {intent} "

    if intent == "CONSUME":
        msg += f"{info.get('amount', 0)}{info.get('unit', '')} {info.get('item_name', '')}\n"
        for batch in item.get("fefo_plan", []):
            brand_str = f" ({batch.get('brand')})" if batch.get("brand") else ""
            msg += f"   → Batch #{batch['batch_id']}{brand_str}, "
            msg += f"expires {batch.get('expiry_date', 'N/A')}, "
            msg += f"deduct {batch['deduct_amount']}\n"
    elif intent == "ADD":
        msg += f"{info.get('quantity', 0)}{info.get('unit', '')} {info.get('item_name', '')}"
        if info.get("expiry_date"):
            msg += f", expires {info['expiry_date']}"
        msg += "\n"
    elif intent == "DISCARD":
        msg += f"batch #{info.get('batch_id', '?')}\n"
    else:
        msg += f"{info.get('item_name', 'all')}\n"

    return msg + "\n"


def calculate_fefo_plan(item_name: str, amount: float, brand: str | None) -> list[dict]:
    """
    Calculate FEFO deduction plan without executing.
    Returns list of batches that would be affected.
    """
    with Session(engine) as db:
        groups = get_inventory_grouped(db)

        # Find the item group
        target_group = None
        for group in groups:
            if group.item_name.lower() == item_name.lower():
                target_group = group
                break

        if not target_group:
            return []

        # Filter by brand if specified
        batches = target_group.batches
        if brand:
            batches = [b for b in batches if b.brand and b.brand.lower() == brand.lower()]

        # Sort by FEFO: is_open DESC, expiry_date ASC
        batches = sorted(
            batches,
            key=lambda b: (not b.is_open, b.expiry_date or date.max),
        )

        # Calculate deduction plan
        plan = []
        remaining = amount
        for batch in batches:
            if remaining <= 0:
                break
            deduct = min(batch.quantity, remaining)
            plan.append({
                "batch_id": batch.id,
                "brand": batch.brand,
                "expiry_date": str(batch.expiry_date) if batch.expiry_date else None,
                "current_quantity": batch.quantity,
                "deduct_amount": deduct,
                "new_quantity": batch.quantity - deduct,
            })
            remaining -= deduct

        return plan


# ============ Node 5: Tool Executor ============

def tool_executor(state: AgentState) -> dict:
    """
    Execute the actual database operations (multi-item support with transaction).
    """
    pending = state.get("pending_action", {})
    items = pending.get("items", [])

    messages = state.get("messages", [])
    user_lang = detect_language(messages)

    tool_calls = state.get("tool_calls", [])
    results = []

    try:
        with Session(engine) as db:
            # Execute all operations in a transaction
            for item in items:
                intent = item["intent"]
                extracted = item["extracted_info"]

                if intent == "ADD":
                    result = execute_add(db, extracted, user_lang)
                elif intent == "CONSUME":
                    result = execute_consume(db, extracted, item.get("fefo_plan", []), user_lang)
                elif intent == "DISCARD":
                    result = execute_discard(db, extracted, user_lang)
                elif intent == "QUERY":
                    result = execute_query(db, extracted, user_lang)
                else:
                    result = f"Unknown intent: {intent}"

                results.append(result)
                tool_calls.append({
                    "tool": f"execute_{intent.lower()}",
                    "args": extracted,
                    "result": "success",
                })

            # Commit all at once (transaction)
            db.commit()

    except Exception as e:
        error_msg = f"操作失败: {str(e)}" if user_lang == "zh" else f"Operation failed: {str(e)}"
        results.append(error_msg)
        tool_calls.append({
            "tool": "batch_execute",
            "args": {"items_count": len(items)},
            "result": f"error: {str(e)}",
        })

    # Combine results
    combined_response = "\n\n".join(results)

    output = {
        "pending_action": None,
        "status": "completed",
        "response": combined_response,
        "tool_calls": tool_calls,
    }

    log_node("Tool_Executor", state, output)
    return output


def execute_add(db: Session, info: dict, lang: str) -> str:
    """Execute ADD operation."""
    print(f"[TOOL CALL] add_inventory({info})")

    # Parse expiry date
    expiry = None
    if info.get("expiry_date"):
        try:
            expiry = date.fromisoformat(info["expiry_date"])
        except ValueError:
            pass

    item_data = InventoryItemCreate(
        item_name=info.get("item_name") or "Unknown",
        brand=info.get("brand"),
        quantity=info.get("quantity") or 1,
        total_volume=info.get("quantity") or 1,
        unit=info.get("unit") or "pcs",
        category=info.get("category"),
        expiry_date=expiry,
        location=info.get("location") or "Fridge",
    )

    item = add_inventory_item(db, item_data)
    print(f"[TOOL RESULT] Added batch #{item.id}")

    if lang == "zh":
        return f"✅ 已添加: {item.quantity}{item.unit} {item.item_name}" + \
               (f" ({item.brand})" if item.brand else "") + \
               f"\n   批次ID: #{item.id}, 位置: {item.location}" + \
               (f", 过期日: {item.expiry_date}" if item.expiry_date else "")
    else:
        return f"✅ Added: {item.quantity}{item.unit} {item.item_name}" + \
               (f" ({item.brand})" if item.brand else "") + \
               f"\n   Batch ID: #{item.id}, Location: {item.location}" + \
               (f", Expires: {item.expiry_date}" if item.expiry_date else "")


def execute_consume(db: Session, info: dict, fefo_plan: list, lang: str) -> str:
    """Execute CONSUME operation."""
    print(f"[TOOL CALL] consume_item({info})")

    result = consume_item(
        db=db,
        item_name=info.get("item_name", ""),
        amount=info.get("amount", 0),
        brand=info.get("brand"),
    )

    print(f"[TOOL RESULT] {result}")

    if not result.success:
        return f"❌ {result.message}"

    if lang == "zh":
        msg = f"✅ 已消耗 {result.consumed_amount} {info.get('item_name')}\n"
        msg += "扣除明细:\n"
        for batch in result.affected_batches:
            brand_str = f" ({batch.get('brand')})" if batch.get("brand") else ""
            msg += f"   - Batch #{batch['batch_id']}{brand_str}: "
            msg += f"{batch['old_quantity']} → {batch['new_quantity']}\n"
        return msg
    else:
        msg = f"✅ Consumed {result.consumed_amount} {info.get('item_name')}\n"
        msg += "Deduction details:\n"
        for batch in result.affected_batches:
            brand_str = f" ({batch.get('brand')})" if batch.get("brand") else ""
            msg += f"   - Batch #{batch['batch_id']}{brand_str}: "
            msg += f"{batch['old_quantity']} → {batch['new_quantity']}\n"
        return msg


def execute_discard(db: Session, info: dict, lang: str) -> str:
    """Execute DISCARD operation."""
    batch_id = info.get("batch_id")
    print(f"[TOOL CALL] discard_batch({batch_id})")

    if not batch_id:
        return "❌ 需要批次ID才能丢弃" if lang == "zh" else "❌ Batch ID required for discard"

    item = discard_batch(db, batch_id)
    print(f"[TOOL RESULT] Discarded batch #{batch_id}")

    if not item:
        return f"❌ 找不到批次 #{batch_id}" if lang == "zh" else f"❌ Batch #{batch_id} not found"

    if lang == "zh":
        return f"✅ 已丢弃批次 #{batch_id}: {item.item_name} ({item.quantity}{item.unit})"
    else:
        return f"✅ Discarded batch #{batch_id}: {item.item_name} ({item.quantity}{item.unit})"


def execute_query(db: Session, info: dict, lang: str) -> str:
    """Execute QUERY operation."""
    item_filter = info.get("item_name")
    print(f"[TOOL CALL] query_inventory(item_name={item_filter})")

    groups = get_inventory_grouped(db)

    if item_filter:
        groups = [g for g in groups if item_filter.lower() in g.item_name.lower()]

    print(f"[TOOL RESULT] Found {len(groups)} item groups")

    if not groups:
        return "库存为空" if lang == "zh" else "Inventory is empty"

    if lang == "zh":
        lines = ["当前库存:"]
        for group in groups:
            lines.append(f"\n📦 {group.item_name}: {group.total_quantity}{group.unit}")
            for batch in group.batches:
                status = "🔓 已开封" if batch.is_open else "🔒 未开封"
                expiry = f"过期 {batch.expiry_date}" if batch.expiry_date else "无过期日"
                brand = f"({batch.brand})" if batch.brand else ""
                lines.append(f"   - #{batch.id} {brand}: {batch.quantity}{batch.unit}, {status}, {expiry}")
        return "\n".join(lines)
    else:
        lines = ["Current Inventory:"]
        for group in groups:
            lines.append(f"\n📦 {group.item_name}: {group.total_quantity}{group.unit}")
            for batch in group.batches:
                status = "🔓 OPEN" if batch.is_open else "🔒 sealed"
                expiry = f"expires {batch.expiry_date}" if batch.expiry_date else "no expiry"
                brand = f"({batch.brand})" if batch.brand else ""
                lines.append(f"   - #{batch.id} {brand}: {batch.quantity}{batch.unit}, {status}, {expiry}")
        return "\n".join(lines)
