"""Node implementations for the tool-calling LangGraph agent."""

import json
from datetime import date
from typing import Any

from langchain_core.messages import AIMessage, ToolMessage

from agent.state import AgentState, READ_TOOLS, WRITE_TOOLS
from agent.tools import ALL_TOOLS
from agent.llm_factory import get_user_llm
from id_codec import decode_or_int
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
    Handle confirm/cancel for pending writes, or pass through to agent.
    System message is prepended in run_agent() to guarantee correct ordering.
    """
    messages = list(state.get("messages", []))

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

        # Fix 4: User sent a new request while pending — discard with feedback
        user_lang = _detect_language(messages)
        from langchain_core.messages import AIMessage as _AIMsg
        discard_msg = "Previous pending operation discarded. Processing your new request." if user_lang == "en" else "已取消之前的待确认操作，正在处理你的新请求。"
        return {
            "messages": [_AIMsg(content=discard_msg)],
            "pending_writes": None,
            "status": "processing",
        }

    return {"pending_writes": None, "status": "processing"}


# ============ Node: agent_node ============

MAX_HISTORY_MESSAGES = 40


def _trim_messages(messages: list) -> list:
    """Keep system message + last MAX_HISTORY_MESSAGES to avoid token overflow."""
    if len(messages) <= MAX_HISTORY_MESSAGES + 1:
        return messages

    # Separate system message(s) from the rest
    system_msgs = []
    other_msgs = []
    for m in messages:
        role = getattr(m, "type", None) or (m.get("role") if isinstance(m, dict) else None)
        if role == "system":
            system_msgs.append(m)
        else:
            other_msgs.append(m)

    # Keep system msgs + last N non-system msgs
    return system_msgs + other_msgs[-MAX_HISTORY_MESSAGES:]


def agent_node(state: AgentState) -> dict:
    """
    Call the LLM with bound tools. The LLM decides what to do:
    - Call a read tool to gather information
    - Call a write tool to modify inventory
    - Respond directly with text (ask follow-up, answer query, etc.)
    """
    user_id = state.get("user_id", "")
    messages = _trim_messages(state.get("messages", []))

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
                from id_codec import encode_inventory_row
                supabase = get_supabase_client()
                real_id = decode_or_int(args["batch_id"])
                fetch = (
                    supabase.table("inventory")
                    .select("*")
                    .eq("id", real_id)
                    .eq("user_id", user_id)
                    .execute()
                )
                result = encode_inventory_row(fetch.data[0]) if fetch.data else None
            elif tool_name == "get_shopping_list":
                from services import get_shopping_items
                result = get_shopping_items(user_id=state["user_id"])

            elif tool_name == "search_saved_recipes":
                from services import get_saved_recipes as _get_saved_recipes
                query = args.get("query", "").strip().lower()
                all_recipes = _get_saved_recipes(user_id, limit=50, offset=0)
                if query:
                    filtered = [
                        r for r in all_recipes
                        if query in r.get("title", "").lower()
                        or any(query in (t or "").lower() for t in (r.get("tags") or []))
                    ]
                else:
                    filtered = all_recipes[:10]
                result = [
                    {"id": r["id"], "title": r["title"], "tags": r.get("tags", []),
                     "cook_time_min": r.get("cook_time_min")}
                    for r in filtered
                ]

            elif tool_name == "get_recipe_details":
                from services import get_saved_recipe as _get_saved_recipe
                real_rid = decode_or_int(args["recipe_id"])
                recipe = _get_saved_recipe(user_id, real_rid)
                if recipe:
                    result = recipe
                else:
                    result = {"error": f"Recipe {args['recipe_id']} not found"}

            elif tool_name == "get_meals":
                from services import get_meals as _get_meals
                result = _get_meals(
                    user_id=user_id,
                    date_from=args.get("date_from"),
                    date_to=args.get("date_to"),
                )

            elif tool_name == "get_meal_details":
                from services import get_meal as _get_meal
                real_mid = decode_or_int(args["meal_id"])
                meal = _get_meal(user_id, real_mid)
                if meal:
                    result = meal
                else:
                    result = {"error": f"Meal {args['meal_id']} not found"}

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
        elif tool_name == "add_to_shopping_list":
            name = args.get("item_name", "?")
            qty = args.get("quantity")
            unit = args.get("unit", "")
            note = args.get("note")
            qty_str = f" {qty}{unit}" if qty else ""
            note_str = f" — {note}" if note else ""
            if user_lang == "zh":
                preview = f"添加到购物清单: {name}{qty_str}{note_str}"
            else:
                preview = f"Add to shopping list: {name}{qty_str}{note_str}"

        elif tool_name == "generate_recipes_tool":
            n = args.get("count", 4)
            cat_str = f" [{args.get('categories')}]" if args.get("categories") else ""
            exp_str = " (prioritize expiring)" if args.get("use_expiring") else ""
            set_str = " (meal set)" if args.get("as_meal_set") else ""
            if user_lang == "zh":
                preview = f'生成 {n} 个菜谱建议: "{args["prompt"]}"{cat_str}{exp_str}{set_str}'
            else:
                preview = f'Generate {n} recipe suggestions: "{args["prompt"]}"{cat_str}{exp_str}{set_str}'

        elif tool_name == "save_recipe":
            if user_lang == "zh":
                preview = f'保存菜谱: "{args["recipe_title"]}"'
            else:
                preview = f'Save recipe: "{args["recipe_title"]}"'

        elif tool_name == "save_all_recipes":
            pending = state.get("pending_recipes") or []
            if pending:
                titles = ", ".join(r["title"] for r in pending)
                if user_lang == "zh":
                    preview = f"保存全部 {len(pending)} 道菜谱: {titles}"
                else:
                    preview = f"Save all {len(pending)} recipes: {titles}"
            else:
                if user_lang == "zh":
                    preview = "没有待保存的菜谱"
                else:
                    preview = "No recipes to save"

        elif tool_name == "delete_recipe":
            from services import get_saved_recipe as _get_saved_recipe
            recipe = _get_saved_recipe(user_id, decode_or_int(args["recipe_id"]))
            title = recipe["title"] if recipe else args['recipe_id']
            if user_lang == "zh":
                preview = f'删除已保存的菜谱: "{title}"'
            else:
                preview = f'Delete saved recipe: "{title}"'

        elif tool_name == "add_recipe_ingredients_to_shopping":
            from services import get_saved_recipe as _get_saved_recipe
            recipe = _get_saved_recipe(user_id, decode_or_int(args["recipe_id"]))
            if recipe:
                missing = [
                    ing["name"] for ing in recipe.get("ingredients", [])
                    if not ing.get("have_in_stock")
                ]
                items_str = ", ".join(missing[:5]) + ("..." if len(missing) > 5 else "")
                if user_lang == "zh":
                    preview = f'将 "{recipe["title"]}" 的 {len(missing)} 种缺少食材添加到购物清单: {items_str}'
                else:
                    preview = f'Add {len(missing)} missing ingredients from "{recipe["title"]}" to shopping list: {items_str}'
            else:
                if user_lang == "zh":
                    preview = f"将菜谱 {args['recipe_id']} 的食材添加到购物清单"
                else:
                    preview = f"Add ingredients from recipe {args['recipe_id']} to shopping list"

        elif tool_name == "create_meal":
            name = args.get("name", "?")
            date_str = f", date: {args['scheduled_date']}" if args.get("scheduled_date") else ""
            type_str = f" ({args['meal_type']})" if args.get("meal_type") else ""
            ids_str = f", recipes: [{args['recipe_ids']}]" if args.get("recipe_ids") else ""
            if user_lang == "zh":
                preview = f"创建餐食: {name}{type_str}{date_str}{ids_str}"
            else:
                preview = f"Create meal: {name}{type_str}{date_str}{ids_str}"

        elif tool_name == "add_recipes_to_meal":
            from services import get_meal as _get_meal
            meal = _get_meal(user_id, decode_or_int(args["meal_id"]))
            meal_name = meal["name"] if meal else args['meal_id']
            if user_lang == "zh":
                preview = f"将菜谱 [{args['recipe_ids']}] 添加到餐食 \"{meal_name}\""
            else:
                preview = f"Add recipes [{args['recipe_ids']}] to meal \"{meal_name}\""

        elif tool_name == "remove_recipe_from_meal":
            from services import get_meal as _get_meal, get_saved_recipe as _gsr
            meal = _get_meal(user_id, decode_or_int(args["meal_id"]))
            recipe = _gsr(user_id, decode_or_int(args["recipe_id"]))
            meal_name = meal["name"] if meal else args['meal_id']
            recipe_title = recipe["title"] if recipe else args['recipe_id']
            if user_lang == "zh":
                preview = f"从餐食 \"{meal_name}\" 中移除菜谱 \"{recipe_title}\""
            else:
                preview = f"Remove \"{recipe_title}\" from meal \"{meal_name}\""

        elif tool_name == "delete_meal":
            from services import get_meal as _get_meal
            meal = _get_meal(user_id, decode_or_int(args["meal_id"]))
            meal_name = meal["name"] if meal else args['meal_id']
            if user_lang == "zh":
                preview = f"删除餐食: \"{meal_name}\""
            else:
                preview = f"Delete meal: \"{meal_name}\""

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
                f"   Batch {batch['batch_id']}{brand_str}: "
                f"{batch['current_quantity']} -> {batch['new_quantity']}, "
                f"过期: {batch.get('expiry_date', 'N/A')}"
            )
        return "\n".join(lines)
    else:
        lines = [f"Consume: {amount}{unit} {name}"]
        for batch in plan:
            brand_str = f" ({batch.get('brand')})" if batch.get("brand") else ""
            lines.append(
                f"   Batch {batch['batch_id']}{brand_str}: "
                f"{batch['current_quantity']} -> {batch['new_quantity']}, "
                f"expires: {batch.get('expiry_date', 'N/A')}"
            )
        return "\n".join(lines)


def _preview_discard(args: dict, user_id: str, lang: str) -> str:
    """Build preview text for discard_batch."""
    batch_id = args.get("batch_id", "?")

    supabase = get_supabase_client()
    real_id = decode_or_int(batch_id) if batch_id != "?" else batch_id
    fetch = (
        supabase.table("inventory")
        .select("*")
        .eq("id", real_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not fetch.data:
        if lang == "zh":
            return f"丢弃: Batch {batch_id} - 未找到"
        return f"Discard: Batch {batch_id} - not found"

    item = fetch.data[0]
    if lang == "zh":
        return f"丢弃: Batch {batch_id} - {item['item_name']} ({item['quantity']}{item['unit']})"
    return f"Discard: Batch {batch_id} - {item['item_name']} ({item['quantity']}{item['unit']})"


def _preview_update(args: dict, user_id: str, lang: str) -> str:
    """Build preview text for update_item."""
    batch_id = args.get("batch_id", "?")
    updates = {k: v for k, v in args.items() if k != "batch_id" and v is not None}

    supabase = get_supabase_client()
    real_id = decode_or_int(batch_id) if batch_id != "?" else batch_id
    fetch = (
        supabase.table("inventory")
        .select("*")
        .eq("id", real_id)
        .eq("user_id", user_id)
        .execute()
    )

    if not fetch.data:
        if lang == "zh":
            return f"更新: Batch {batch_id} - 未找到"
        return f"Update: Batch {batch_id} - not found"

    item = fetch.data[0]
    changes = []
    for key, new_val in updates.items():
        old_val = item.get(key, "?")
        changes.append(f"{key}: {old_val} -> {new_val}")

    changes_str = ", ".join(changes)
    if lang == "zh":
        return f"更新: {item['item_name']} (Batch {batch_id}) - {changes_str}"
    return f"Update: {item['item_name']} (Batch {batch_id}) - {changes_str}"


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
    new_pending_recipes = None

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
            elif tool_name == "add_to_shopping_list":
                result_text = _execute_add_to_shopping(user_id, args, user_lang)

            elif tool_name == "generate_recipes_tool":
                from services import generate_recipes as _generate_recipes
                cats = [c.strip() for c in args.get("categories", "").split(",") if c.strip()]
                gen_result = _generate_recipes(
                    user_id=user_id,
                    categories=cats,
                    use_expiring=args.get("use_expiring", False),
                    prompt=args["prompt"],
                    count=args.get("count"),
                    as_meal_set=args.get("as_meal_set", False),
                )
                recipes_data = gen_result.get("recipes", [])
                feasibility = gen_result.get("feasibility_notice")
                new_pending_recipes = recipes_data
                summary_parts = []
                if feasibility:
                    summary_parts.append(f"Note: {feasibility}")
                for idx, r in enumerate(recipes_data, 1):
                    time_str = f" ({r.get('cook_time_min', '?')} min)" if r.get("cook_time_min") else ""
                    summary_parts.append(f"{idx}. {r['title']}{time_str} — {r.get('description', '')}")
                result_text = "\n".join(summary_parts)

            elif tool_name == "save_recipe":
                from services import save_recipe as _save_recipe
                pending = state.get("pending_recipes") or []
                title = args["recipe_title"]
                # Exact match first
                match = next((r for r in pending if r["title"].lower() == title.lower()), None)
                # Fuzzy match: check if query is a substring or if titles share significant words
                if not match and pending:
                    title_lower = title.lower()
                    # Substring match
                    match = next((r for r in pending if title_lower in r["title"].lower() or r["title"].lower() in title_lower), None)
                if not match and pending:
                    # Word overlap match (>= 50% of words match)
                    title_words = set(title.lower().split())
                    best_score, best_r = 0, None
                    for r in pending:
                        r_words = set(r["title"].lower().split())
                        overlap = len(title_words & r_words)
                        score = overlap / max(len(title_words), len(r_words), 1)
                        if score > best_score:
                            best_score, best_r = score, r
                    if best_score >= 0.4:
                        match = best_r
                if not match:
                    avail = ", ".join(r["title"] for r in pending)
                    result_text = f'Recipe "{title}" not found in recent generation. Available: {avail}' if user_lang == "en" else f'在最近生成的菜谱中未找到 "{title}"。可选: {avail}'
                else:
                    saved = _save_recipe(
                        user_id=user_id,
                        recipe=match,
                        source_mode="agent",
                        source_prompt=title,
                        image_prompt=match.get("image_prompt"),
                    )
                    result_text = f'Saved: "{saved["title"]}" (ID {saved["id"]})' if user_lang == "en" else f'已保存: "{saved["title"]}" (ID {saved["id"]})'
                    # Fix 6: Remove saved recipe from pending to prevent duplicate saves
                    remaining = [r for r in pending if r is not match]
                    new_pending_recipes = remaining if remaining else []

            elif tool_name == "save_all_recipes":
                from services import save_recipe as _save_recipe_all
                pending = state.get("pending_recipes") or []
                if not pending:
                    result_text = "No recipes to save" if user_lang == "en" else "没有待保存的菜谱"
                else:
                    saved_titles = []
                    for recipe in pending:
                        saved = _save_recipe_all(
                            user_id=user_id,
                            recipe=recipe,
                            source_mode="agent",
                            source_prompt=recipe.get("title", ""),
                            image_prompt=recipe.get("image_prompt"),
                        )
                        saved_titles.append(f'"{saved["title"]}" ({saved["id"]})')
                    titles_str = ", ".join(saved_titles)
                    result_text = f"Saved {len(saved_titles)} recipes: {titles_str}" if user_lang == "en" else f"已保存 {len(saved_titles)} 道菜谱: {titles_str}"
                    # Clear pending recipes after saving all
                    new_pending_recipes = []

            elif tool_name == "delete_recipe":
                from services import delete_saved_recipe as _delete_saved_recipe
                _delete_saved_recipe(user_id, decode_or_int(args["recipe_id"]))
                result_text = f"Deleted recipe {args['recipe_id']}" if user_lang == "en" else f"已删除菜谱 {args['recipe_id']}"

            elif tool_name == "add_recipe_ingredients_to_shopping":
                from services import get_saved_recipe as _get_saved_recipe, add_shopping_item
                from schemas import ShoppingItemCreate
                recipe = _get_saved_recipe(user_id, decode_or_int(args["recipe_id"]))
                if not recipe:
                    result_text = f"Recipe {args['recipe_id']} not found" if user_lang == "en" else f"找不到菜谱 {args['recipe_id']}"
                else:
                    missing = [
                        ing for ing in recipe.get("ingredients", [])
                        if not ing.get("have_in_stock")
                    ]
                    added = []
                    for ing in missing:
                        item = ShoppingItemCreate(
                            item_name=ing["name"],
                            quantity=ing.get("quantity"),
                            unit=ing.get("unit"),
                            source="recipe",
                            source_recipe_id=recipe["id"],
                            source_recipe_title=recipe["title"],
                        )
                        add_shopping_item(user_id, item)
                        added.append(ing["name"])
                    items_str = ", ".join(added)
                    result_text = f"Added {len(added)} items to shopping list: {items_str}" if user_lang == "en" else f"已将 {len(added)} 种食材添加到购物清单: {items_str}"

            elif tool_name == "create_meal":
                from services import create_meal as _create_meal
                from schemas import MealCreate
                rid_str = args.get("recipe_ids", "")
                rids = [x.strip() for x in rid_str.split(",") if x.strip()] if rid_str else []
                sd = None
                if args.get("scheduled_date"):
                    try:
                        sd = date.fromisoformat(args["scheduled_date"])
                    except ValueError:
                        pass
                meal_data = MealCreate(
                    name=args["name"],
                    scheduled_date=sd,
                    meal_type=args.get("meal_type"),
                    recipe_ids=rids,
                )
                meal = _create_meal(user_id, meal_data)
                recipe_names = ", ".join(r["title"] for r in meal.get("recipes", []))
                date_info = f" on {meal.get('scheduled_date')}" if meal.get("scheduled_date") else ""
                if user_lang == "zh":
                    result_text = f"已创建餐食: \"{meal['name']}\"{date_info}"
                    if recipe_names:
                        result_text += f"\n   菜谱: {recipe_names}"
                else:
                    result_text = f"Created meal: \"{meal['name']}\"{date_info}"
                    if recipe_names:
                        result_text += f"\n   Recipes: {recipe_names}"

            elif tool_name == "add_recipes_to_meal":
                from services import add_recipes_to_meal as _add_to_meal
                rid_str = args.get("recipe_ids", "")
                rids = [decode_or_int(x.strip()) for x in rid_str.split(",") if x.strip()]
                meal = _add_to_meal(user_id, decode_or_int(args["meal_id"]), rids)
                if not meal:
                    result_text = f"Meal {args['meal_id']} not found" if user_lang == "en" else f"找不到餐食 {args['meal_id']}"
                else:
                    result_text = f"Added {len(rids)} recipe(s) to \"{meal['name']}\"" if user_lang == "en" else f"已将 {len(rids)} 道菜谱添加到 \"{meal['name']}\""

            elif tool_name == "remove_recipe_from_meal":
                from services import remove_recipe_from_meal as _remove_from_meal
                meal = _remove_from_meal(user_id, decode_or_int(args["meal_id"]), decode_or_int(args["recipe_id"]))
                if not meal:
                    result_text = f"Meal {args['meal_id']} not found" if user_lang == "en" else f"找不到餐食 {args['meal_id']}"
                else:
                    result_text = f"Removed recipe from \"{meal['name']}\"" if user_lang == "en" else f"已从 \"{meal['name']}\" 中移除菜谱"

            elif tool_name == "delete_meal":
                from services import delete_meal as _delete_meal
                if _delete_meal(user_id, decode_or_int(args["meal_id"])):
                    result_text = f"Deleted meal {args['meal_id']}" if user_lang == "en" else f"已删除餐食 {args['meal_id']}"
                else:
                    result_text = f"Meal {args['meal_id']} not found" if user_lang == "en" else f"找不到餐食 {args['meal_id']}"

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

    update: dict[str, Any] = {
        "messages": [AIMessage(content=combined)],
        "pending_writes": None,
        "status": "completed",
        "response": combined,
        "tool_calls_log": tool_calls_log,
    }
    if new_pending_recipes is not None:
        update["pending_recipes"] = new_pending_recipes
    return update


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

    row = add_inventory_item(user_id, item_data, raw_input=raw_input or None, source="agent")

    if lang == "zh":
        msg = f"已添加: {row['quantity']}{row['unit']} {row['item_name']}"
        if row.get("brand"):
            msg += f" ({row['brand']})"
        msg += f"\n   Batch {row['id']}, 位置: {row['location']}"
        if row.get("expiry_date"):
            msg += f", 过期日: {row['expiry_date']}"
        return msg
    else:
        msg = f"Added: {row['quantity']}{row['unit']} {row['item_name']}"
        if row.get("brand"):
            msg += f" ({row['brand']})"
        msg += f"\n   Batch {row['id']}, Location: {row['location']}"
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
        source="agent",
    )

    if not result.success:
        return result.message

    if lang == "zh":
        msg = f"已消耗 {result.consumed_amount} {args.get('item_name')}\n"
        msg += "扣除明细:\n"
        for batch in result.affected_batches:
            brand_str = f" ({batch.get('brand')})" if batch.get("brand") else ""
            msg += f"   - Batch {batch['batch_id']}{brand_str}: {batch['old_quantity']} -> {batch['new_quantity']}\n"
        return msg
    else:
        msg = f"Consumed {result.consumed_amount} {args.get('item_name')}\n"
        msg += "Deduction details:\n"
        for batch in result.affected_batches:
            brand_str = f" ({batch.get('brand')})" if batch.get("brand") else ""
            msg += f"   - Batch {batch['batch_id']}{brand_str}: {batch['old_quantity']} -> {batch['new_quantity']}\n"
        return msg


def _execute_discard(user_id: str, args: dict, lang: str, raw_input: str = "") -> str:
    """Execute discard_batch operation."""
    batch_id = args.get("batch_id")
    if not batch_id:
        return "Batch ID required for discard" if lang == "en" else "需要批次ID才能丢弃"

    real_id = decode_or_int(batch_id)
    item = svc_discard_batch(user_id, real_id, raw_input=raw_input or None, source="agent")

    if not item:
        return f"Batch {batch_id} not found" if lang == "en" else f"找不到批次 {batch_id}"

    if lang == "zh":
        return f"已丢弃批次 {batch_id}: {item['item_name']} ({item['quantity']}{item['unit']})"
    return f"Discarded batch {batch_id}: {item['item_name']} ({item['quantity']}{item['unit']})"


def _execute_add_to_shopping(user_id: str, args: dict[str, Any], lang: str) -> str:
    """Execute add_to_shopping_list operation."""
    from services import add_shopping_item as svc_add_shopping
    from schemas import ShoppingItemCreate
    item = ShoppingItemCreate(
        item_name=args.get("item_name", ""),
        quantity=args.get("quantity"),
        unit=args.get("unit"),
        note=args.get("note"),
        source="agent",
    )
    row = svc_add_shopping(user_id, item)
    if lang == "zh":
        return f"已添加到购物清单: {row['item_name']}"
    return f"Added to shopping list: {row['item_name']}"


def _execute_update(user_id: str, args: dict, lang: str, raw_input: str = "") -> str:
    """Execute update_item operation."""
    batch_id = args.get("batch_id")
    if not batch_id:
        return "Batch ID required for update" if lang == "en" else "需要批次ID才能更新"

    real_id = decode_or_int(batch_id)
    updates = {k: v for k, v in args.items() if k != "batch_id" and v is not None}

    row = update_batch(
        user_id=user_id,
        batch_id=real_id,
        updates=updates,
        raw_input=raw_input or None,
    )

    if not row:
        return f"Batch {batch_id} not found" if lang == "en" else f"找不到批次 {batch_id}"

    changes_str = ", ".join(f"{k}: {v}" for k, v in updates.items())
    if lang == "zh":
        return f"已更新 {row['item_name']} (Batch {batch_id}): {changes_str}"
    return f"Updated {row['item_name']} (Batch {batch_id}): {changes_str}"


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
