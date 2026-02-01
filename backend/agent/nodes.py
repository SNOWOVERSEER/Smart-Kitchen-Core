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
    get_ask_more_prompt,
)
from agent.state import AgentState, PendingAction, REQUIRED_FIELDS
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
            "intent": "QUERY",
            "extracted_info": {},
            "confidence": "low",
            "raw_understanding": "Could not parse user input",
        }

    intent = analysis.get("intent", "QUERY")
    extracted_info = analysis.get("extracted_info", {})

    # Create pending action
    pending_action: PendingAction = {
        "intent": intent,
        "extracted_info": extracted_info,
        "missing_fields": [],
        "needs_confirmation": False,
        "confirmation_message": "",
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

    # Check for positive/negative confirmation (includes internal "confirm"/"cancel")
    positive = ["yes", "y", "confirm", "确认", "是", "好", "ok", "确定", "可以", "行"]
    negative = ["no", "n", "cancel", "取消", "否", "不", "不要", "算了"]

    pending = state.get("pending_action")
    messages = state.get("messages", [])
    user_lang = detect_language(messages)

    if any(p in user_input_lower for p in positive):
        # User confirmed - proceed to execution
        return {
            "pending_action": pending,
            "status": "confirmed",
        }
    elif any(n in user_input_lower for n in negative):
        # User rejected - clear pending and respond
        cancel_msg = "好的，已取消操作。还有什么需要帮忙的吗？" if user_lang == "zh" else "OK, operation cancelled. Anything else I can help with?"
        return {
            "pending_action": None,
            "status": "completed",
            "response": cancel_msg,
        }
    else:
        # Unclear response - ask again
        retry_msg = "请确认是否执行？回复'确认'或'取消'" if user_lang == "zh" else "Please confirm: reply 'yes' or 'no'"
        return {
            "pending_action": pending,
            "status": "awaiting_confirm",
            "response": retry_msg,
        }


def handle_additional_info(state: AgentState, user_input: str) -> dict:
    """Handle additional info provided by user for slot filling."""
    pending = state.get("pending_action", {})
    extracted = pending.get("extracted_info", {})
    missing = pending.get("missing_fields", [])

    # Use LLM to extract the additional info
    llm = get_llm()
    prompt = f"""The user is providing additional information for a {pending.get('intent')} operation.
We already have: {extracted}
We're missing: {missing}

User's response: {user_input}

Extract any new information. Return JSON with only the NEW fields found:
{{"field_name": "value", ...}}

Remember:
- Translate Chinese food names to English
- Convert units: ml→L (÷1000), g→kg (÷1000)
- Dates in YYYY-MM-DD format
"""

    response = llm.invoke([HumanMessage(content=prompt)])

    try:
        content = response.content
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        new_info = json.loads(content.strip())
    except (json.JSONDecodeError, IndexError):
        new_info = {}

    # Merge new info
    extracted.update(new_info)

    # Update pending action
    pending["extracted_info"] = extracted
    pending["missing_fields"] = get_missing_fields(pending["intent"], extracted)

    return {
        "pending_action": pending,
        "status": "processing",
    }


# ============ Node 2: Information Validator ============

def information_validator(state: AgentState) -> dict:
    """
    Validate extracted information and decide next step.
    Routes to: ask_more, confirm, or execute.
    """
    pending = state.get("pending_action")
    if not pending:
        output = {"status": "completed", "response": "No action pending."}
        log_node("Information_Validator", state, output)
        return output

    intent = pending.get("intent", "QUERY")
    extracted = pending.get("extracted_info", {})

    # Check for missing required fields
    missing = get_missing_fields(intent, extracted)
    pending["missing_fields"] = missing

    if missing:
        # Need more info
        output = {
            "pending_action": pending,
            "status": "awaiting_info",
            "next": "ask_more",
        }
    elif intent in ["CONSUME", "DISCARD"]:
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
    Generate follow-up question for missing information.
    """
    pending = state.get("pending_action", {})
    intent = pending.get("intent", "")
    extracted = pending.get("extracted_info", {})
    missing = pending.get("missing_fields", [])

    # Get the original user language from messages
    messages = state.get("messages", [])
    user_lang = detect_language(messages)

    llm = get_llm()
    prompt = get_ask_more_prompt(intent, extracted, missing)

    # Add language hint
    lang_hint = "Respond in Chinese." if user_lang == "zh" else "Respond in English."

    response = llm.invoke([
        SystemMessage(content=prompt),
        HumanMessage(content=f"{lang_hint}\nGenerate a natural follow-up question for the missing fields: {missing}"),
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
    Generate confirmation message and prepare FEFO plan.
    This node uses interrupt_before to pause for user confirmation.
    """
    pending = state.get("pending_action", {})
    intent = pending.get("intent", "")
    extracted = pending.get("extracted_info", {})

    messages = state.get("messages", [])
    user_lang = detect_language(messages)

    # For CONSUME, calculate FEFO plan
    fefo_plan = []
    if intent == "CONSUME":
        fefo_plan = calculate_fefo_plan(
            item_name=extracted.get("item_name", ""),
            amount=extracted.get("amount", 0),
            brand=extracted.get("brand"),
        )
        pending["fefo_plan"] = fefo_plan

    # Generate confirmation message
    llm = get_llm()

    if intent == "CONSUME" and fefo_plan:
        # Build FEFO confirmation message
        item_name = extracted.get("item_name", "item")
        amount = extracted.get("amount", 0)
        unit = extracted.get("unit", "")

        if user_lang == "zh":
            msg = f"系统将执行以下操作：\n📦 消耗 {amount}{unit} {item_name}\n"
            for batch in fefo_plan:
                brand_str = f" ({batch.get('brand')})" if batch.get("brand") else ""
                msg += f"   → 扣除: Batch #{batch['batch_id']}{brand_str}, "
                msg += f"过期日 {batch.get('expiry_date', 'N/A')}, "
                msg += f"数量: {batch['deduct_amount']}{unit}\n"
            msg += "\n确认执行？[是/否]"
        else:
            msg = f"System will execute:\n📦 Consume {amount}{unit} {item_name}\n"
            for batch in fefo_plan:
                brand_str = f" ({batch.get('brand')})" if batch.get("brand") else ""
                msg += f"   → Deduct: Batch #{batch['batch_id']}{brand_str}, "
                msg += f"expires {batch.get('expiry_date', 'N/A')}, "
                msg += f"amount: {batch['deduct_amount']}{unit}\n"
            msg += "\nConfirm? [Yes/No]"

        pending["confirmation_message"] = msg
    else:
        # Generic confirmation
        if user_lang == "zh":
            msg = f"确认要执行 {intent} 操作吗？\n详情: {extracted}\n[是/否]"
        else:
            msg = f"Confirm {intent} operation?\nDetails: {extracted}\n[Yes/No]"
        pending["confirmation_message"] = msg

    output = {
        "pending_action": pending,
        "status": "awaiting_confirm",
        "response": pending["confirmation_message"],
    }

    log_node("Confirm", state, output)
    return output


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
    Execute the actual database operation.
    """
    pending = state.get("pending_action", {})
    intent = pending.get("intent", "")
    extracted = pending.get("extracted_info", {})

    messages = state.get("messages", [])
    user_lang = detect_language(messages)

    tool_calls = state.get("tool_calls", [])
    result_message = ""

    try:
        with Session(engine) as db:
            if intent == "ADD":
                result_message = execute_add(db, extracted, user_lang)
            elif intent == "CONSUME":
                result_message = execute_consume(db, extracted, pending.get("fefo_plan", []), user_lang)
            elif intent == "DISCARD":
                result_message = execute_discard(db, extracted, user_lang)
            elif intent == "QUERY":
                result_message = execute_query(db, extracted, user_lang)

            tool_calls.append({
                "tool": f"execute_{intent.lower()}",
                "args": extracted,
                "result": "success",
            })

    except Exception as e:
        result_message = f"操作失败: {str(e)}" if user_lang == "zh" else f"Operation failed: {str(e)}"
        tool_calls.append({
            "tool": f"execute_{intent.lower()}",
            "args": extracted,
            "result": f"error: {str(e)}",
        })

    output = {
        "pending_action": None,
        "status": "completed",
        "response": result_message,
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
