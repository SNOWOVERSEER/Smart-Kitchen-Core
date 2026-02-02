"""LangGraph construction for the Smart Kitchen agent."""

import asyncio
import uuid
from typing import Literal

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from agent.state import AgentState
from agent.nodes import (
    intent_analyst,
    information_validator,
    ask_more,
    confirm,
    tool_executor,
)


def route_after_validator(state: AgentState) -> Literal["ask_more", "confirm", "execute", "end"]:
    """
    Router function: decides next node after validation.
    """
    # Check if already completed
    if state.get("status") == "completed":
        return "end"

    # Check the next step set by validator
    next_step = state.get("next")
    if next_step:
        return next_step

    # Default based on status
    status = state.get("status")
    if status == "awaiting_info":
        return "ask_more"
    elif status == "awaiting_confirm":
        return "confirm"
    elif status == "confirmed":
        return "execute"

    return "end"


def route_after_intent(state: AgentState) -> Literal["validator", "execute", "end"]:
    """
    Router function: decides next node after intent analysis.
    """
    status = state.get("status")

    if status == "completed":
        return "end"

    if status == "confirmed":
        # User confirmed - go directly to execution
        return "execute"

    # Otherwise, go to validation
    return "validator"


def build_graph() -> StateGraph:
    """Build and return the agent graph."""

    # Create the graph
    graph = StateGraph(AgentState)

    # Add nodes
    graph.add_node("intent_analyst", intent_analyst)
    graph.add_node("validator", information_validator)
    graph.add_node("ask_more", ask_more)
    graph.add_node("confirm", confirm)
    graph.add_node("execute", tool_executor)

    # Set entry point
    graph.set_entry_point("intent_analyst")

    # Add edges with routing
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

    # Terminal nodes go to END
    graph.add_edge("ask_more", END)
    graph.add_edge("confirm", END)
    graph.add_edge("execute", END)

    return graph


# Global memory saver for checkpointing
memory_saver = MemorySaver()


def get_compiled_graph():
    """Get the compiled graph with checkpointer."""
    graph = build_graph()
    return graph.compile(
        checkpointer=memory_saver,
        # interrupt_before=["confirm"],  # Pause before confirmation
    )


def run_agent(
    text: str,
    thread_id: str | None = None,
    confirm_action: bool | None = None,
) -> dict:
    """
    Run the agent with user input.

    Args:
        text: User's natural language input
        thread_id: Thread ID for conversation continuity (None = new conversation)
        confirm_action: Explicit confirmation (True/False) or None for natural language

    Returns:
        dict with response, thread_id, status, pending_action, tool_calls
    """
    # Generate thread_id if not provided
    if not thread_id:
        thread_id = str(uuid.uuid4())

    # Get compiled graph
    app = get_compiled_graph()

    # Build input message
    if confirm_action is not None:
        # Explicit confirmation (internal message, use English)
        input_text = "confirm" if confirm_action else "cancel"
    else:
        input_text = text

    # Prepare input state
    input_state = {
        "messages": [{"role": "user", "content": input_text}],
        "thread_id": thread_id,
    }

    # Configuration for checkpointing
    config = {"configurable": {"thread_id": thread_id}}

    # Run the graph
    try:
        result = app.invoke(input_state, config)
    except Exception as e:
        print(f"[ERROR] Graph execution failed: {e}")
        return {
            "response": f"Error: {str(e)}",
            "thread_id": thread_id,
            "status": "error",
            "pending_action": None,
            "tool_calls": [],
        }

    # Extract results
    response = result.get("response", "")
    status = result.get("status", "completed")
    pending_action = result.get("pending_action")
    tool_calls = result.get("tool_calls", [])

    # Clear checkpoint if conversation completed to invalidate thread_id
    if status == "completed":
        try:
            # Try async delete first (LangGraph official API)
            loop = asyncio.new_event_loop()
            loop.run_until_complete(memory_saver.adelete_thread(thread_id))
            loop.close()
            print(f"[CLEANUP] Thread {thread_id} checkpoint cleared")
        except Exception as e:
            # Fallback: direct storage access for MemorySaver
            if hasattr(memory_saver, "storage"):
                memory_saver.storage.pop(thread_id, None)
                print(f"[CLEANUP] Thread {thread_id} cleared via storage")
            else:
                print(f"[CLEANUP] Note: Could not clear thread {thread_id}: {e}")

    # Format pending_action for response (multi-item support)
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
