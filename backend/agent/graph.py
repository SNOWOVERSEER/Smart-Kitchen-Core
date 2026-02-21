"""LangGraph construction for the Kitchen Loop tool-calling agent."""

import uuid
from typing import Any

from langgraph.graph import StateGraph, END

from agent.state import AgentState
from agent.nodes import (
    handle_input,
    agent_node,
    route_agent,
    execute_read_tools,
    build_write_preview,
    execute_write_tools,
    respond,
)
from database import get_supabase_client


def build_graph() -> StateGraph:
    """Build and return the tool-calling agent graph."""
    graph = StateGraph(AgentState)

    graph.add_node("handle_input", handle_input)
    graph.add_node("agent", agent_node)
    graph.add_node("execute_read", execute_read_tools)
    graph.add_node("build_preview", build_write_preview)
    graph.add_node("execute_write", execute_write_tools)
    graph.add_node("respond", respond)

    graph.set_entry_point("handle_input")

    # After handle_input: if confirmed -> execute_write, otherwise -> agent
    graph.add_conditional_edges(
        "handle_input",
        lambda state: "execute_write" if state.get("status") == "confirmed" else (
            "respond" if state.get("status") == "completed" else "agent"
        ),
        {
            "agent": "agent",
            "execute_write": "execute_write",
            "respond": "respond",
        },
    )

    # After agent: route based on tool calls
    graph.add_conditional_edges(
        "agent",
        route_agent,
        {
            "execute_read": "execute_read",
            "build_preview": "build_preview",
            "execute_write": "execute_write",
            "respond": "respond",
        },
    )

    # Read tools loop back to agent for next decision
    graph.add_edge("execute_read", "agent")

    # Preview and execute both end
    graph.add_edge("build_preview", "respond")
    graph.add_edge("execute_write", "respond")
    graph.add_edge("respond", END)

    return graph


class SupabaseCheckpointer:
    """Custom checkpointer backed by Supabase agent_conversations table."""

    def get(self, thread_id: str) -> dict | None:
        supabase = get_supabase_client()
        result = (
            supabase.table("agent_conversations")
            .select("checkpoint_data")
            .eq("thread_id", thread_id)
            .eq("status", "active")
            .limit(1)
            .execute()
        )
        if result.data:
            return result.data[0]["checkpoint_data"]
        return None

    def put(self, thread_id: str, user_id: str, data: dict):
        supabase = get_supabase_client()
        supabase.table("agent_conversations").upsert({
            "thread_id": thread_id,
            "user_id": user_id,
            "checkpoint_data": data,
            "status": "active",
        }, on_conflict="thread_id").execute()

    def complete(self, thread_id: str, final_messages: list[dict]):
        """Mark conversation completed and save final message history."""
        supabase = get_supabase_client()
        supabase.table("agent_conversations").update({
            "status": "completed",
            "checkpoint_data": {"messages": final_messages},
        }).eq("thread_id", thread_id).execute()


checkpointer = SupabaseCheckpointer()


def _serialize_messages(messages: list) -> list[dict]:
    """Convert LangChain messages to serializable dicts for checkpointing."""
    serialized = []
    for m in messages:
        if hasattr(m, "type") and hasattr(m, "content"):
            msg_dict: dict[str, Any] = {"role": m.type, "content": m.content}
            # Preserve tool calls on AIMessages
            if hasattr(m, "tool_calls") and m.tool_calls:
                msg_dict["tool_calls"] = m.tool_calls
            # Preserve tool_call_id on ToolMessages
            if hasattr(m, "tool_call_id") and m.tool_call_id:
                msg_dict["tool_call_id"] = m.tool_call_id
            serialized.append(msg_dict)
        elif isinstance(m, dict):
            serialized.append(m)
    return serialized


def run_agent(
    text: str,
    user_id: str,
    thread_id: str | None = None,
    confirm_action: bool | None = None,
) -> dict:
    """
    Run the agent with user input, scoped to a specific user.

    Args:
        text: User's natural language input
        user_id: Authenticated user's UUID
        thread_id: Thread ID for conversation continuity (None = new conversation)
        confirm_action: Explicit confirmation (True/False) or None for natural language

    Returns:
        dict with response, thread_id, status, pending_action, tool_calls
    """
    if not thread_id:
        thread_id = str(uuid.uuid4())

    # Load existing state from checkpoint
    existing_state = checkpointer.get(thread_id)

    # Build graph
    graph = build_graph()
    app = graph.compile()

    # Build input text
    if confirm_action is not None:
        input_text = "confirm" if confirm_action else "cancel"
    else:
        input_text = text

    # Build input state
    input_state: dict[str, Any] = {}

    if existing_state:
        # Restore saved state
        saved_messages = existing_state.get("messages", [])
        input_state["messages"] = saved_messages
        input_state["pending_writes"] = existing_state.get("pending_writes")
        input_state["status"] = existing_state.get("status", "processing")
    else:
        input_state["messages"] = []

    # Append new user message
    input_state["messages"] = input_state.get("messages", []) + [
        {"role": "user", "content": input_text}
    ]
    input_state["user_id"] = user_id

    try:
        result = app.invoke(input_state)
    except Exception as e:
        print(f"[ERROR] Graph execution failed: {e}")
        import traceback
        traceback.print_exc()
        return {
            "response": f"Error: {str(e)}",
            "thread_id": thread_id,
            "status": "error",
            "pending_action": None,
            "tool_calls": [],
        }

    response = result.get("response", "")
    status = result.get("status", "completed")
    pending_writes = result.get("pending_writes")
    tool_calls_log = result.get("tool_calls_log", [])

    # Serialize messages for checkpoint
    messages_to_save = _serialize_messages(result.get("messages", []))

    # Save or clear checkpoint
    if status == "completed":
        checkpointer.complete(thread_id, messages_to_save)
        print(f"[CLEANUP] Thread {thread_id} completed")
    else:
        checkpoint = {
            "messages": messages_to_save,
            "pending_writes": pending_writes,
            "status": status,
            "user_id": user_id,
        }
        checkpointer.put(thread_id, user_id, checkpoint)

    # Build pending_action for API response (matches frontend schema)
    pending_dict = None
    if pending_writes:
        items = []
        for i, pw in enumerate(pending_writes):
            tool_name = pw["tool"]
            args = pw["args"]

            # Map tool name to intent for frontend compatibility
            intent_map = {
                "add_item": "ADD",
                "consume_item": "CONSUME",
                "discard_batch": "DISCARD",
                "update_item": "UPDATE",
            }

            items.append({
                "index": i,
                "intent": intent_map.get(tool_name, tool_name.upper()),
                "extracted_info": args,
                "missing_fields": [],
            })

        pending_dict = {
            "items": items,
            "confirmation_message": result.get("preview_message", ""),
        }

    return {
        "response": response,
        "thread_id": thread_id,
        "status": status,
        "pending_action": pending_dict,
        "tool_calls": tool_calls_log,
    }
