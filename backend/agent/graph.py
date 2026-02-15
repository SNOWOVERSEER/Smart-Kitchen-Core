"""LangGraph construction for the Smart Kitchen agent."""

import uuid
from typing import Literal

from langgraph.graph import StateGraph, END

from agent.state import AgentState
from agent.nodes import (
    intent_analyst,
    information_validator,
    ask_more,
    confirm,
    tool_executor,
)
from database import get_supabase_client


def route_after_validator(state: AgentState) -> Literal["ask_more", "confirm", "execute", "end"]:
    """Router function: decides next node after validation."""
    if state.get("status") == "completed":
        return "end"

    next_step = state.get("next")
    if next_step:
        return next_step

    status = state.get("status")
    if status == "awaiting_info":
        return "ask_more"
    elif status == "awaiting_confirm":
        return "confirm"
    elif status == "confirmed":
        return "execute"

    return "end"


def route_after_intent(state: AgentState) -> Literal["validator", "execute", "end"]:
    """Router function: decides next node after intent analysis."""
    status = state.get("status")

    if status == "completed":
        return "end"

    if status == "confirmed":
        return "execute"

    return "validator"


def build_graph() -> StateGraph:
    """Build and return the agent graph."""
    graph = StateGraph(AgentState)

    graph.add_node("intent_analyst", intent_analyst)
    graph.add_node("validator", information_validator)
    graph.add_node("ask_more", ask_more)
    graph.add_node("confirm", confirm)
    graph.add_node("execute", tool_executor)

    graph.set_entry_point("intent_analyst")

    graph.add_conditional_edges(
        "intent_analyst",
        route_after_intent,
        {
            "validator": "validator",
            "execute": "execute",
            "end": END,
        },
    )

    graph.add_conditional_edges(
        "validator",
        route_after_validator,
        {
            "ask_more": "ask_more",
            "confirm": "confirm",
            "execute": "execute",
            "end": END,
        },
    )

    graph.add_edge("ask_more", END)
    graph.add_edge("confirm", END)
    graph.add_edge("execute", END)

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

    # Build graph (no LangGraph checkpointer - we manage state manually)
    graph = build_graph()
    app = graph.compile()

    # Build input
    if confirm_action is not None:
        input_text = "confirm" if confirm_action else "cancel"
    else:
        input_text = text

    # Merge with existing state if continuing conversation
    input_state = existing_state or {}
    input_state["messages"] = input_state.get("messages", []) + [
        {"role": "user", "content": input_text}
    ]
    input_state["thread_id"] = thread_id
    input_state["user_id"] = user_id

    try:
        result = app.invoke(input_state)
    except Exception as e:
        print(f"[ERROR] Graph execution failed: {e}")
        return {
            "response": f"Error: {str(e)}",
            "thread_id": thread_id,
            "status": "error",
            "pending_action": None,
            "tool_calls": [],
        }

    response = result.get("response", "")
    status = result.get("status", "completed")
    pending_action = result.get("pending_action")
    tool_calls = result.get("tool_calls", [])

    # Build message history including AI response
    messages_to_save = [
        {"role": getattr(m, "type", "user"), "content": getattr(m, "content", str(m))}
        for m in result.get("messages", [])
    ]
    if response:
        messages_to_save.append({"role": "assistant", "content": response})

    # Save or clear checkpoint
    if status == "completed":
        checkpointer.complete(thread_id, messages_to_save)
        print(f"[CLEANUP] Thread {thread_id} completed")
    else:
        checkpoint = {
            "messages": messages_to_save,
            "pending_action": pending_action,
            "status": status,
            "user_id": user_id,
            "thread_id": thread_id,
        }
        checkpointer.put(thread_id, user_id, checkpoint)

    # Format pending_action for response
    pending_dict = None
    if pending_action:
        items = pending_action.get("items", [])
        pending_dict = {
            "items": [
                {
                    "index": item.get("index", i),
                    "intent": item.get("intent"),
                    "extracted_info": item.get("extracted_info"),
                    "missing_fields": item.get("missing_fields"),
                }
                for i, item in enumerate(items)
            ],
            "confirmation_message": pending_action.get("confirmation_message"),
        }

    return {
        "response": response,
        "thread_id": thread_id,
        "status": status,
        "pending_action": pending_dict,
        "tool_calls": tool_calls,
    }
