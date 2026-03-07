"""LangGraph construction for the Kitchen Loop AI tool-calling agent."""

import json
import queue
import threading
import uuid
from typing import Any, Generator

from langchain_core.messages import BaseMessageChunk, SystemMessage
from langgraph.graph import StateGraph, END

from database import _current_access_token
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
from agent.prompt import get_system_prompt
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

# Pre-compile graph once (structure is static; state varies per request)
_compiled_app = build_graph().compile()


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


def _build_input_state(
    text: str,
    user_id: str,
    thread_id: str,
    confirm_action: bool | None,
) -> dict[str, Any]:
    """Build the graph input state from request params + checkpoint."""
    existing_state = checkpointer.get(thread_id)

    input_text = ("confirm" if confirm_action else "cancel") if confirm_action is not None else text

    input_state: dict[str, Any] = {}
    if existing_state:
        input_state["messages"] = existing_state.get("messages", [])
        input_state["pending_writes"] = existing_state.get("pending_writes")
        input_state["pending_recipes"] = existing_state.get("pending_recipes")
        input_state["status"] = existing_state.get("agent_status", "processing")
    else:
        input_state["messages"] = []

    has_system = any(
        isinstance(m, SystemMessage) or (isinstance(m, dict) and m.get("role") == "system")
        for m in input_state["messages"]
    )
    if not has_system:
        from agent.nodes import _get_user_language
        user_lang = _get_user_language(user_id)
        if any("\u4e00" <= c <= "\u9fff" for c in input_text):
            user_lang = "zh"
        system_msg = {"role": "system", "content": get_system_prompt(user_lang)}
        input_state["messages"] = [system_msg] + input_state["messages"]

    input_state["messages"] = input_state["messages"] + [
        {"role": "user", "content": input_text}
    ]
    input_state["user_id"] = user_id
    return input_state


def _build_response(result: dict, thread_id: str) -> dict:
    """Build the API response dict from graph result + save checkpoint."""
    response = result.get("response", "")
    status = result.get("status", "completed")
    pending_writes = result.get("pending_writes")
    tool_calls_log = result.get("tool_calls_log", [])
    pending_recipes = result.get("pending_recipes")

    # Save checkpoint
    messages_to_save = _serialize_messages(result.get("messages", []))
    checkpoint = {
        "messages": messages_to_save,
        "pending_writes": pending_writes,
        "pending_recipes": pending_recipes,
        "agent_status": status,
        "user_id": result.get("user_id", ""),
    }
    checkpointer.put(thread_id, result.get("user_id", ""), checkpoint)

    # Build pending_action for frontend
    pending_dict = None
    if pending_writes:
        intent_map = {
            "add_item": "ADD",
            "consume_item": "CONSUME",
            "discard_batch": "DISCARD",
            "update_item": "UPDATE",
        }
        pending_dict = {
            "items": [
                {
                    "index": i,
                    "intent": intent_map.get(pw["tool"], pw["tool"].upper()),
                    "extracted_info": pw["args"],
                    "missing_fields": [],
                }
                for i, pw in enumerate(pending_writes)
            ],
            "confirmation_message": result.get("preview_message", ""),
        }

    return {
        "response": response,
        "thread_id": thread_id,
        "status": status,
        "pending_action": pending_dict,
        "tool_calls": tool_calls_log,
        "pending_recipes": pending_recipes,
    }


def run_agent(
    text: str,
    user_id: str,
    thread_id: str | None = None,
    confirm_action: bool | None = None,
) -> dict:
    """Run the agent synchronously (blocking). Returns full result dict."""
    if not thread_id:
        thread_id = str(uuid.uuid4())

    input_state = _build_input_state(text, user_id, thread_id, confirm_action)

    try:
        result = _compiled_app.invoke(input_state, config={"recursion_limit": 25})
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

    return _build_response(result, thread_id)


def _sse(event: str, data: dict) -> str:
    """Format a Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


def _extract_fragments(content: Any) -> list[tuple[str, str]]:
    """Extract typed text fragments from Anthropic/OpenAI message content."""
    if isinstance(content, str):
        return [("text", content)] if content else []

    if isinstance(content, dict):
        block_type = content.get("type")
        if block_type == "thinking" and isinstance(content.get("thinking"), str):
            return [("thinking", content["thinking"])]
        if block_type == "text" and isinstance(content.get("text"), str):
            return [("text", content["text"])]
        if isinstance(content.get("thinking"), str):
            return [("thinking", content["thinking"])]
        if isinstance(content.get("text"), str):
            return [("text", content["text"])]
        return []

    if isinstance(content, list):
        fragments: list[tuple[str, str]] = []
        for item in content:
            fragments.extend(_extract_fragments(item))
        return fragments

    return [("text", str(content))] if content else []


# Sentinel to signal the background thread is done
_STREAM_DONE = "___DONE___"


def run_agent_stream(
    text: str,
    user_id: str,
    thread_id: str | None = None,
    confirm_action: bool | None = None,
) -> Generator[str, None, None]:
    """Run the agent with chunk-level SSE streaming.

    Yields SSE events:
      event: thread_id  — thread ID for frontend tracking
      event: node       — graph node completed (for progress indication)
      event: token      — individual LLM token (real-time character streaming)
      event: thinking_token — model reasoning/thinking text
      event: done       — final structured payload (same shape as AgentActionResponse)

    Implementation: runs the graph in a background thread and uses LangGraph's
    native ``stream_mode=["messages", "updates"]``. ``messages`` yields model
    chunks immediately; ``updates`` yields completed node updates for progress.
    """
    if not thread_id:
        thread_id = str(uuid.uuid4())

    input_state = _build_input_state(text, user_id, thread_id, confirm_action)

    # Yield thread_id immediately so frontend can track it
    yield _sse("thread_id", {"thread_id": thread_id})

    token_queue: queue.Queue[dict] = queue.Queue()
    result_holder: list[dict[str, Any]] = []
    error_holder: list[Exception] = []
    cancel_event = threading.Event()

    # Capture the auth context from the request thread so the worker
    # thread can re-set it (contextvars don't propagate to new threads).
    request_token = _current_access_token.get()

    def _run_graph() -> None:
        """Run the graph in a background thread, pushing events to the queue."""
        # Propagate auth context into this thread
        if request_token:
            _current_access_token.set(request_token)

        try:
            last_state: dict[str, Any] = {}

            for mode, payload in _compiled_app.stream(
                input_state,
                config={"recursion_limit": 25},
                stream_mode=["messages", "updates"],
            ):
                if cancel_event.is_set():
                    break

                if mode == "messages":
                    message, metadata = payload
                    if not isinstance(message, BaseMessageChunk):
                        continue
                    # Only surface tokens from the main agent node. Other LLM calls
                    # (e.g. structured recipe generation inside tools) can stream raw
                    # JSON/tool payloads that should not appear in the chat bubble.
                    if metadata.get("langgraph_node") != "agent":
                        continue
                    for fragment_type, content in _extract_fragments(message.content):
                        event_type = "thinking_token" if fragment_type == "thinking" else "token"
                        token_queue.put({
                            "type": event_type,
                            "content": content,
                            "node": metadata.get("langgraph_node"),
                        })
                    continue

                if mode == "updates":
                    for node_name, state_update in payload.items():
                        token_queue.put({"type": "node", "node": node_name})
                        if state_update:
                            last_state.update(state_update)

            merged = {**input_state, **last_state}
            result_holder.append(merged)
        except Exception as e:
            error_holder.append(e)
        finally:
            token_queue.put({"type": _STREAM_DONE})

    # Start graph execution in background thread
    worker = threading.Thread(target=_run_graph, daemon=True)
    worker.start()

    # Main generator: read from queue and yield SSE events
    try:
        while True:
            try:
                event = token_queue.get(timeout=120)
            except queue.Empty:
                cancel_event.set()
                yield _sse("done", {
                    "response": "Request timed out.",
                    "thread_id": thread_id,
                    "status": "error",
                    "pending_action": None,
                    "tool_calls": [],
                    "pending_recipes": None,
                })
                return

            if event["type"] == _STREAM_DONE:
                break
            elif event["type"] == "token":
                yield _sse("token", {"content": event["content"]})
            elif event["type"] == "thinking_token":
                yield _sse("thinking_token", {"content": event["content"]})
            elif event["type"] == "node":
                yield _sse("node", {"node": event["node"]})

        # Thread finished — build and yield final response
        if error_holder:
            e = error_holder[0]
            print(f"[ERROR] Stream graph execution failed: {e}")
            import traceback
            traceback.print_exc()
            yield _sse("done", {
                "response": f"Error: {str(e)}",
                "thread_id": thread_id,
                "status": "error",
                "pending_action": None,
                "tool_calls": [],
                "pending_recipes": None,
            })
        elif result_holder:
            final = _build_response(result_holder[0], thread_id)
            yield _sse("done", final)
        else:
            yield _sse("done", {
                "response": "No response from agent.",
                "thread_id": thread_id,
                "status": "error",
                "pending_action": None,
                "tool_calls": [],
                "pending_recipes": None,
            })
    except GeneratorExit:
        # Client disconnected — signal the worker to stop
        cancel_event.set()
    finally:
        worker.join(timeout=5)
