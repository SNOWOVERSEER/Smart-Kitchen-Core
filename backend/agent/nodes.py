"""Node implementations for the tool-calling LangGraph agent."""

import json
from datetime import date
from typing import Any

from langchain_core.messages import AIMessage, SystemMessage, ToolMessage

from agent.prompt import get_system_prompt
from agent.state import AgentState, READ_TOOLS, WRITE_TOOLS
from agent.tools import ALL_TOOLS
from agent.llm_factory import get_user_llm
from services import (
    search_inventory,
    update_batch,
    consume_item as svc_consume_item,
    add_inventory_item,
    discard_batch as svc_discard_batch,
    get_inventory_grouped,
)
from schemas import InventoryItemCreate
from database import get_supabase_client


def _detect_language(messages: list) -> str:
    """Detect if user is speaking Chinese or English from human messages only.

    Only checks human/user messages (not system or tool messages) to avoid
    false positives from Chinese examples in the system prompt.
    Skips pure confirmation/cancellation words.
    """
    skip_content = {
        "confirm", "cancel", "yes", "no", "y", "n", "ok",
        "是", "好", "确认", "确定", "执行", "否", "不", "取消", "算了",
    }
    for msg in reversed(messages):
        # Determine message type
        msg_type = getattr(msg, "type", None)
        if msg_type is None and isinstance(msg, dict):
            msg_type = msg.get("role")
        # Only check human/user messages
        if msg_type not in ("human", "user"):
            continue
        content = msg.content if hasattr(msg, "content") else msg.get("content", "")
        if not isinstance(content, str):
            continue
        # Skip pure confirmation/cancellation words
        if content.strip().lower() in skip_content:
            continue
        # Detect language from first substantive human message
        if any("\u4e00" <= char <= "\u9fff" for char in content):
            return "zh"
        if content.strip():
            return "en"
    return "en"


def _get_user_language(user_id: str) -> str:
    """Get user's preferred language from profile."""
    try:
        supabase = get_supabase_client()
        result = supabase.table("profiles").select("preferred_language").eq("id", user_id).limit(1).execute()
        if result.data:
            return result.data[0].get("preferred_language", "en")
    except Exception:
        pass
    return "en"


# ============ Node: handle_input ============

def handle_input(state: AgentState) -> dict:
    """
    Prepare the initial state. Adds system message if this is the first turn.
    Handles confirm/cancel for pending writes.
    """
    messages = list(state.get("messages", []))
    user_id = state.get("user_id", "")

    # Check if this is a confirmation of pending writes
    pending_writes = state.get("pending_writes")
    if pending_writes and messages:
        last_msg = messages[-1]
        last_content = (last_msg.content if hasattr(last_msg, "content") else str(last_msg)).lower().strip()

        # Check for explicit confirmation
        confirm_words = {"confirm", "yes", "y", "ok", "是", "好", "可以", "行", "嗯", "对", "确认", "确定", "执行"}
        cancel_words = {"cancel", "no", "n", "否", "不", "取消", "算了", "不要了", "不执行"}
        negation_patterns = ["不对", "不是", "不行", "错了", "wrong", "not right", "wait"]

        # Check negation first (higher priority)
        if any(neg in last_content for neg in negation_patterns):
            user_lang = _detect_language(messages)
            cancel_msg = "OK, cancelled. Please tell me the correct operation." if user_lang == "en" else "好的，已取消。请重新告诉我正确的操作。"
            return {
                "pending_writes": None,
                "status": "completed",
                "response": cancel_msg,
            }

        if last_content in confirm_words:
            # Route to execute_write — keep pending_writes, set status
            return {"status": "confirmed"}

        if last_content in cancel_words:
            user_lang = _detect_language(messages)
            cancel_msg = "OK, operation cancelled. Anything else I can help with?" if user_lang == "en" else "好的，已取消操作。还有什么需要帮忙的吗？"
            return {
                "pending_writes": None,
                "status": "completed",
                "response": cancel_msg,
            }

    # Ensure system message is present
    has_system = any(
        isinstance(m, SystemMessage) or (isinstance(m, dict) and m.get("role") == "system")
        for m in messages
    )

    if not has_system:
        user_lang = _get_user_language(user_id)
        # Also detect from current message
        msg_lang = _detect_language(messages)
        if msg_lang == "zh":
            user_lang = "zh"

        system_msg = SystemMessage(content=get_system_prompt(user_lang))
        return {
            "messages": [system_msg],
            "pending_writes": None,
            "status": "processing",
        }

    return {"pending_writes": None, "status": "processing"}


# ============ Node: agent_node ============

def agent_node(state: AgentState) -> dict:
    """
    Call the LLM with bound tools. The LLM decides what to do:
    - Call a read tool to gather information
    - Call a write tool to modify inventory
    - Respond directly with text (ask follow-up, answer query, etc.)
    """
    user_id = state.get("user_id", "")
    messages = state.get("messages", [])

    llm = get_user_llm(user_id)
    llm_with_tools = llm.bind_tools(ALL_TOOLS)

    response = llm_with_tools.invoke(messages)

    return {"messages": [response]}


# ============ Router: route_agent ============

def route_agent(state: AgentState) -> str:
    """
    Route based on the LLM's response:
    - If it called read tools -> "execute_read"
    - If it called write tools -> "build_preview"
    - If no tool calls -> "respond"
    """
    # Check for confirmed status (from handle_input)
    if state.get("status") == "confirmed":
        return "execute_write"

    messages = state.get("messages", [])
    if not messages:
        return "respond"

    last_message = messages[-1]

    # Check if it's an AIMessage with tool calls
    if isinstance(last_message, AIMessage) and last_message.tool_calls:
        tool_names = {tc["name"] for tc in last_message.tool_calls}

        # If any write tools, route to preview
        if tool_names & WRITE_TOOLS:
            return "build_preview"

        # If only read tools, execute them
        if tool_names & READ_TOOLS:
            return "execute_read"

    return "respond"


# ============ Node: execute_read_tools ============

def execute_read_tools(state: AgentState) -> dict:
    """Execute read tool calls and return results as ToolMessages."""
    messages = state.get("messages", [])
    user_id = state.get("user_id", "")
    tool_calls_log = list(state.get("tool_calls_log", []))

    last_message = messages[-1]
    if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
        return {}

    tool_messages = []

    for tc in last_message.tool_calls:
        tool_name = tc["name"]
        args = tc["args"]

        print(f"[READ TOOL] {tool_name}({args})")

        try:
            if tool_name == "search_inventory":
                result = search_inventory(
                    user_id=user_id,
                    item_name=args.get("item_name"),
                    brand=args.get("brand"),
                    location=args.get("location"),
                )
            elif tool_name == "get_batch_details":
                supabase = get_supabase_client()
                fetch = (
                    supabase.table("inventory")
                    .select("*")
                    .eq("id", args["batch_id"])
                    .eq("user_id", user_id)
                    .execute()
                )
                result = fetch.data[0] if fetch.data else None
            else:
                result = f"Unknown read tool: {tool_name}"

            print(f"[READ RESULT] {tool_name}: {json.dumps(result, default=str)[:200]}")

        except Exception as e:
            result = f"Error executing {tool_name}: {str(e)}"
            print(f"[READ ERROR] {tool_name}: {e}")

        tool_messages.append(
            ToolMessage(content=json.dumps(result, default=str), tool_call_id=tc["id"])
        )
        tool_calls_log.append({
            "tool": tool_name,
            "args": args,
            "result": "success" if not isinstance(result, str) or not result.startswith("Error") else "error",
        })

    return {"messages": tool_messages, "tool_calls_log": tool_calls_log}


# ============ Node: build_preview ============

def build_write_preview(state: AgentState) -> dict:
    """
    Dry-run write tool calls to build a confirmation preview.
    Stores the pending writes for later execution.
    """
    messages = state.get("messages", [])
    user_id = state.get("user_id", "")
    user_lang = _detect_language(messages)

    last_message = messages[-1]
    if not isinstance(last_message, AIMessage) or not last_message.tool_calls:
        return {"status": "completed", "response": "No operations to preview."}

    pending_writes = []
    preview_parts = []

    for i, tc in enumerate(last_message.tool_calls):
        tool_name = tc["name"]
        args = tc["args"]

        print(f"[PREVIEW] {tool_name}({args})")

        if tool_name == "add_item":
            preview = _preview_add(args, user_lang)
        elif tool_name == "consume_item":
            preview = _preview_consume(args, user_id, user_lang)
        elif tool_name == "discard_batch":
            preview = _preview_discard(args, user_id, user_lang)
        elif tool_name == "update_item":
            preview = _preview_update(args, user_id, user_lang)
        else:
            preview = f"Unknown write tool: {tool_name}"

        pending_writes.append({"tool": tool_name, "args": args, "tool_call_id": tc["id"]})
        preview_parts.append(f"{i + 1}. {preview}")

    # Build confirmation message
    if user_lang == "zh":
        header = "将执行以下操作：\n\n"
        footer = "\n\n确认执行？回复 '确认' 或 '取消'"
    else:
        header = "The following operations will be performed:\n\n"
        footer = "\n\nConfirm? Reply 'yes' or 'cancel'"

    confirmation = header + "\n".join(preview_parts) + footer

    # Add a ToolMessage for each tool call so the message history stays valid
    tool_messages = []
    for pw in pending_writes:
        tool_messages.append(
            ToolMessage(
                content="[Preview generated - awaiting confirmation]",
                tool_call_id=pw["tool_call_id"],
            )
        )

    return {
        "messages": tool_messages + [AIMessage(content=confirmation)],
        "pending_writes": pending_writes,
        "preview_message": confirmation,
        "status": "awaiting_confirm",
        "response": confirmation,
    }


def _preview_add(args: dict, lang: str) -> str:
    """Build preview text for add_item."""
    name = args.get("item_name", "?")
    qty = args.get("quantity", "?")
    unit = args.get("unit", "?")
    loc = args.get("location", "?")
    brand = f" ({args['brand']})" if args.get("brand") else ""
    expiry = f", expires {args['expiry_date']}" if args.get("expiry_date") else ""
    cat = f", category: {args['category']}" if args.get("category") else ""

    if lang == "zh":
        return f"添加: {qty}{unit} {name}{brand}, 位置: {loc}{expiry}{cat}"
    return f"Add: {qty}{unit} {name}{brand}, location: {loc}{expiry}{cat}"


def _preview_consume(args: dict, user_id: str, lang: str) -> str:
    """Build preview text for consume_item with FEFO plan."""
    name = args.get("item_name", "?")
    amount = args.get("amount", 0)
    brand = args.get("brand")
    unit = args.get("unit", "")

    # Calculate FEFO plan
    plan = _calculate_fefo_plan(user_id, name, amount, brand)

    if not plan:
        if lang == "zh":
            return f"消耗: {amount}{unit} {name} - 未找到匹配的库存"
        return f"Consume: {amount}{unit} {name} - no matching inventory found"

    if lang == "zh":
        lines = [f"消耗: {amount}{unit} {name}"]
        for batch in plan:
            brand_str = f" ({batch.get('brand')})" if batch.get("brand") else ""
            lines.append(
                f"   Batch #{batch['batch_id']}{brand_str}: "
                f"{batch['current_quantity']} -> {batch['new_quantity']}, "
                f"过期: {batch.get('expiry_date', 'N/A')}"
            )
        return "\n".join(lines)
    else:
        lines = [f"Consume: {amount}{unit} {name}"]
        for batch in plan:
            brand_str = f" ({batch.get('brand')})" if batch.get("brand") else ""
            lines.append(
                f"   Batch #{batch['batch_id']}{brand_str}: "
                f"{batch['current_quantity']} -> {batch['new_quantity']}, "
                f"expires: {batch.get('expiry_date', 'N/A')}"
            )
        return "\n".join(lines)


def _preview_discard(args: dict, user_id: str, lang: str) -> str:
    """Build preview text for discard_batch."""
    batch_id = args.get("batch_id", "?")

    supabase = get_supabase_client()
    fetch = (
        supabase.table("inventory")
        .select("*")
        .eq("id", batch_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not fetch.data:
        if lang == "zh":
            return f"丢弃: Batch #{batch_id} - 未找到"
        return f"Discard: Batch #{batch_id} - not found"

    item = fetch.data[0]
    if lang == "zh":
        return f"丢弃: Batch #{batch_id} - {item['item_name']} ({item['quantity']}{item['unit']})"
    return f"Discard: Batch #{batch_id} - {item['item_name']} ({item['quantity']}{item['unit']})"


def _preview_update(args: dict, user_id: str, lang: str) -> str:
    """Build preview text for update_item."""
    batch_id = args.get("batch_id", "?")
    updates = {k: v for k, v in args.items() if k != "batch_id" and v is not None}

    supabase = get_supabase_client()
    fetch = (
        supabase.table("inventory")
        .select("*")
        .eq("id", batch_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not fetch.data:
        if lang == "zh":
            return f"更新: Batch #{batch_id} - 未找到"
        return f"Update: Batch #{batch_id} - not found"

    item = fetch.data[0]
    changes = []
    for key, new_val in updates.items():
        old_val = item.get(key, "?")
        changes.append(f"{key}: {old_val} -> {new_val}")

    changes_str = ", ".join(changes)
    if lang == "zh":
        return f"更新: {item['item_name']} (Batch #{batch_id}) - {changes_str}"
    return f"Update: {item['item_name']} (Batch #{batch_id}) - {changes_str}"


def _calculate_fefo_plan(
    user_id: str,
    item_name: str,
    amount: float,
    brand: str | None,
) -> list[dict]:
    """Calculate FEFO deduction plan without executing."""
    groups = get_inventory_grouped(user_id)

    target_group = None
    for group in groups:
        if group.item_name.lower() == item_name.lower():
            target_group = group
            break

    if not target_group:
        return []

    batches = target_group.batches
    if brand:
        batches = [b for b in batches if b.brand and b.brand.lower() == brand.lower()]

    batches = sorted(
        batches,
        key=lambda b: (not b.is_open, b.expiry_date or date.max),
    )

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
            "deduct_amount": round(deduct, 3),
            "new_quantity": round(batch.quantity - deduct, 3),
        })
        remaining = round(remaining - deduct, 3)

    return plan


# ============ Node: execute_write_tools ============

def execute_write_tools(state: AgentState) -> dict:
    """Execute the confirmed write operations."""
    pending_writes = state.get("pending_writes", [])
    user_id = state.get("user_id", "")
    messages = state.get("messages", [])
    user_lang = _detect_language(messages)
    tool_calls_log = list(state.get("tool_calls_log", []))

    # Extract the most recent user message that triggered this action (not a confirmation).
    # Iterate in reverse so multi-turn conversations pick the latest substantive input,
    # not an old query from earlier in the thread.
    raw_input = ""
    skip_words = {
        "confirm", "cancel", "yes", "no", "y", "n", "ok",
        "是", "好", "确认", "确定", "执行", "否", "不", "取消", "算了",
    }
    for msg in reversed(messages):
        content = msg.content if hasattr(msg, "content") else str(msg)
        msg_type = getattr(msg, "type", None) or (msg.get("role") if isinstance(msg, dict) else None)
        if msg_type in ("human", "user") and content.strip().lower() not in skip_words:
            raw_input = content
            break

    results = []

    for pw in pending_writes or []:
        tool_name = pw["tool"]
        args = pw["args"]

        print(f"[EXECUTE] {tool_name}({args})")

        try:
            if tool_name == "add_item":
                result_text = _execute_add(user_id, args, user_lang, raw_input)
            elif tool_name == "consume_item":
                result_text = _execute_consume(user_id, args, user_lang, raw_input)
            elif tool_name == "discard_batch":
                result_text = _execute_discard(user_id, args, user_lang, raw_input)
            elif tool_name == "update_item":
                result_text = _execute_update(user_id, args, user_lang, raw_input)
            else:
                result_text = f"Unknown tool: {tool_name}"

            results.append(result_text)
            tool_calls_log.append({
                "tool": tool_name,
                "args": args,
                "result": "success",
            })

        except Exception as e:
            error_msg = f"Operation failed: {str(e)}" if user_lang == "en" else f"操作失败: {str(e)}"
            results.append(error_msg)
            tool_calls_log.append({
                "tool": tool_name,
                "args": args,
                "result": f"error: {str(e)}",
            })

    combined = "\n\n".join(results)

    return {
        "messages": [AIMessage(content=combined)],
        "pending_writes": None,
        "status": "completed",
        "response": combined,
        "tool_calls_log": tool_calls_log,
    }


def _execute_add(user_id: str, args: dict, lang: str, raw_input: str = "") -> str:
    """Execute add_item operation."""
    expiry = None
    if args.get("expiry_date"):
        try:
            expiry = date.fromisoformat(args["expiry_date"])
        except ValueError:
            pass

    total_vol = args.get("total_volume") or args.get("quantity", 1)

    item_data = InventoryItemCreate(
        item_name=args.get("item_name", "Unknown"),
        brand=args.get("brand"),
        quantity=args.get("quantity", 1),
        total_volume=total_vol,
        unit=args.get("unit", "pcs"),
        category=args.get("category"),
        expiry_date=expiry,
        is_open=args.get("is_open", False),
        location=args.get("location", "Fridge"),
    )

    row = add_inventory_item(user_id, item_data, raw_input=raw_input or None)

    if lang == "zh":
        msg = f"已添加: {row['quantity']}{row['unit']} {row['item_name']}"
        if row.get("brand"):
            msg += f" ({row['brand']})"
        msg += f"\n   Batch #{row['id']}, 位置: {row['location']}"
        if row.get("expiry_date"):
            msg += f", 过期日: {row['expiry_date']}"
        return msg
    else:
        msg = f"Added: {row['quantity']}{row['unit']} {row['item_name']}"
        if row.get("brand"):
            msg += f" ({row['brand']})"
        msg += f"\n   Batch #{row['id']}, Location: {row['location']}"
        if row.get("expiry_date"):
            msg += f", Expires: {row['expiry_date']}"
        return msg


def _execute_consume(user_id: str, args: dict, lang: str, raw_input: str = "") -> str:
    """Execute consume_item operation."""
    result = svc_consume_item(
        user_id=user_id,
        item_name=args.get("item_name", ""),
        amount=args.get("amount", 0),
        brand=args.get("brand"),
        raw_input=raw_input or None,
    )

    if not result.success:
        return result.message

    if lang == "zh":
        msg = f"已消耗 {result.consumed_amount} {args.get('item_name')}\n"
        msg += "扣除明细:\n"
        for batch in result.affected_batches:
            brand_str = f" ({batch.get('brand')})" if batch.get("brand") else ""
            msg += f"   - Batch #{batch['batch_id']}{brand_str}: {batch['old_quantity']} -> {batch['new_quantity']}\n"
        return msg
    else:
        msg = f"Consumed {result.consumed_amount} {args.get('item_name')}\n"
        msg += "Deduction details:\n"
        for batch in result.affected_batches:
            brand_str = f" ({batch.get('brand')})" if batch.get("brand") else ""
            msg += f"   - Batch #{batch['batch_id']}{brand_str}: {batch['old_quantity']} -> {batch['new_quantity']}\n"
        return msg


def _execute_discard(user_id: str, args: dict, lang: str, raw_input: str = "") -> str:
    """Execute discard_batch operation."""
    batch_id = args.get("batch_id")
    if not batch_id:
        return "Batch ID required for discard" if lang == "en" else "需要批次ID才能丢弃"

    item = svc_discard_batch(user_id, batch_id, raw_input=raw_input or None)

    if not item:
        return f"Batch #{batch_id} not found" if lang == "en" else f"找不到批次 #{batch_id}"

    if lang == "zh":
        return f"已丢弃批次 #{batch_id}: {item['item_name']} ({item['quantity']}{item['unit']})"
    return f"Discarded batch #{batch_id}: {item['item_name']} ({item['quantity']}{item['unit']})"


def _execute_update(user_id: str, args: dict, lang: str, raw_input: str = "") -> str:
    """Execute update_item operation."""
    batch_id = args.get("batch_id")
    if not batch_id:
        return "Batch ID required for update" if lang == "en" else "需要批次ID才能更新"

    updates = {k: v for k, v in args.items() if k != "batch_id" and v is not None}

    row = update_batch(
        user_id=user_id,
        batch_id=batch_id,
        updates=updates,
        raw_input=raw_input or None,
    )

    if not row:
        return f"Batch #{batch_id} not found" if lang == "en" else f"找不到批次 #{batch_id}"

    changes_str = ", ".join(f"{k}: {v}" for k, v in updates.items())
    if lang == "zh":
        return f"已更新 {row['item_name']} (Batch #{batch_id}): {changes_str}"
    return f"Updated {row['item_name']} (Batch #{batch_id}): {changes_str}"


# ============ Node: respond ============

def respond(state: AgentState) -> dict:
    """
    Format the final response. Extracts text from the last AIMessage
    if no explicit response was set.
    """
    # If response was already set (by handle_input or execute_write), use it
    if state.get("response"):
        return {}

    messages = state.get("messages", [])
    if not messages:
        return {"response": "I'm not sure how to help with that.", "status": "completed"}

    last_message = messages[-1]

    # If the last message is an AIMessage with text content (no tool calls)
    if isinstance(last_message, AIMessage) and last_message.content:
        return {
            "response": last_message.content,
            "status": state.get("status", "completed"),
        }

    return {"response": "I'm not sure how to help with that.", "status": "completed"}
