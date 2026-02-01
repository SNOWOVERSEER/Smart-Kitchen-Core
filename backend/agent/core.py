"""Core agent implementation using LangChain."""

import os
from datetime import date

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent

from agent.tools import inventory_tools


# System prompt for the kitchen assistant
SYSTEM_PROMPT = """You are a Smart Kitchen Assistant that helps manage grocery inventory.

## Your Capabilities
You can:
1. **Query** current inventory (query_inventory)
2. **Consume** items when used (consume_inventory) - uses FEFO logic
3. **Add** new items when purchased (add_inventory)
4. **Discard** expired or unwanted items (discard_inventory)

## Important Rules
1. **ALWAYS use English item names when calling tools** (database uses English)
   - 牛奶 → Milk, 鸡蛋 → Eggs, 鸡肉 → Chicken, 面包 → Bread
   - 苹果 → Apple, 香蕉 → Banana, 酸奶 → Yogurt, 奶酪 → Cheese
2. ALWAYS query inventory first if you need to know what's available
3. For consumption: the system uses FEFO (First Expired, First Out)
   - Open items are consumed first
   - Then items expiring soonest
4. If user mentions a specific brand (e.g., "A2 milk"), pass the brand parameter
5. Respond in the same language as the user (Chinese or English)
6. Be concise but informative

## Unit Conversions
- 1L = 1000ml, so 500ml = 0.5L
- 1kg = 1000g, so 200g = 0.2kg

## Today's Date
{today}

## Examples
- "drink 500ml milk" → consume 0.5L of Milk
- "bought 2L A2 milk expiring Feb 10" → add 2L Milk, brand=A2, expiry=2024-02-10
- "discard expired eggs" → first query, then discard the expired batch
"""


def get_agent():
    """Create and return the agent executor."""
    llm = ChatOpenAI(
        model="gpt-4o",
        temperature=0,
        api_key=os.getenv("OPENAI_API_KEY"),
    )

    # Format system prompt with today's date
    system_message = SystemMessage(content=SYSTEM_PROMPT.format(today=date.today().isoformat()))

    # Create the agent using LangGraph's prebuilt ReAct agent
    # Use prompt parameter instead of state_modifier
    agent = create_react_agent(
        model=llm,
        tools=inventory_tools,
        prompt=system_message,
    )

    return agent


def run_agent(user_input: str) -> dict:
    """
    Run the agent with user input and return the result.

    Returns:
        dict with keys:
        - response: The agent's final response
        - tool_calls: List of tools called and their results
    """
    agent = get_agent()

    # Run the agent
    result = agent.invoke({
        "messages": [HumanMessage(content=user_input)]
    })

    # Extract the final response and tool calls
    messages = result.get("messages", [])

    # Get the final AI message
    final_response = ""
    tool_calls = []

    for msg in messages:
        if hasattr(msg, "content") and msg.content:
            # Check if it's the final AI response (not a tool message)
            if msg.type == "ai" and not hasattr(msg, "tool_calls"):
                final_response = msg.content
            elif msg.type == "ai" and hasattr(msg, "tool_calls") and msg.tool_calls:
                # Record tool calls
                for tc in msg.tool_calls:
                    tool_calls.append({
                        "tool": tc.get("name"),
                        "args": tc.get("args"),
                    })
        # Capture tool results
        if msg.type == "tool":
            tool_calls.append({
                "tool": msg.name,
                "result": msg.content,
            })

    # If no explicit final response, use the last message
    if not final_response and messages:
        last_msg = messages[-1]
        if hasattr(last_msg, "content"):
            final_response = last_msg.content

    return {
        "response": final_response,
        "tool_calls": tool_calls,
    }
