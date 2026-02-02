# SmartKitchen Core

An intelligent kitchen inventory management system with batch-level tracking and natural language processing.

## Highlights

- **Batch-Level Tracking**: Unlike simple TODO lists, every inventory entry is a distinct "Batch" with its own expiry date, brand, and quantity
- **FEFO Logic**: First Expired, First Out - automatically prioritizes consuming items that expire soonest
- **AI-Powered**: Natural language interface supporting both Chinese and English
- **Multi-Item Operations**: Process multiple items in one command ("I drank milk and ate 3 eggs")
- **Human-in-the-Loop**: Confirmation flow before destructive operations (consume/discard)
- **Multi-Turn Conversations**: Slot filling for incomplete commands with correction detection

## Tech Stack

| Layer        | Technology                              |
| ------------ | --------------------------------------- |
| Backend      | Python 3.11+ / FastAPI                  |
| Database     | PostgreSQL (Docker)                     |
| ORM          | SQLModel (SQLAlchemy + Pydantic)        |
| AI Framework | LangChain / LangGraph                   |
| LLM          | OpenAI GPT-4o                           |
| Frontend     | React + TypeScript + Tailwind (Phase 4) |

## Quick Start

### Prerequisites

- Python 3.11+
- Docker & Docker Compose
- OpenAI API Key

### 1. Clone and Setup

```bash
git clone https://github.com/yourusername/smart-kitchen-core.git
cd smart-kitchen-core
```

### 2. Environment Variables

Create a `.env` file in the project root:

```env
# Database
POSTGRES_HOST=db
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=smartkitchen

# OpenAI
OPENAI_API_KEY=sk-your-key-here
```

### 3. Start Services

```bash
# Start all services (PostgreSQL + API)
docker-compose up -d

# Or start individually:
docker-compose up -d db      # PostgreSQL only
docker-compose up -d api     # API server only
```

The API will be available at `http://localhost:8001`

### 4. Verify Installation

```bash
# Health check
curl http://localhost:8001/

# Expected response:
# {"status": "online", "service": "SmartKitchen Backend", ...}
```

## API Reference

### Base URL

```
http://localhost:8001/api/v1
```

### Inventory Endpoints

#### List Inventory (Grouped)

```http
GET /inventory
```

Returns inventory grouped by item name with nested batch details.

**Response:**
```json
[
  {
    "item_name": "Milk",
    "total_quantity": 2.5,
    "unit": "L",
    "batches": [
      {
        "id": 1,
        "item_name": "Milk",
        "brand": "A2",
        "quantity": 1.5,
        "total_volume": 2.0,
        "unit": "L",
        "expiry_date": "2026-02-10",
        "is_open": true,
        "location": "Fridge"
      }
    ]
  }
]
```

#### List All Batches (Flat)

```http
GET /inventory/all
```

Returns all inventory batches as a flat list.

#### Add Inventory

```http
POST /inventory
Content-Type: application/json

{
  "item_name": "Milk",
  "brand": "A2",
  "quantity": 2.0,
  "total_volume": 2.0,
  "unit": "L",
  "category": "Dairy",
  "expiry_date": "2026-02-15",
  "is_open": false,
  "location": "Fridge"
}
```

#### Discard Batch

```http
DELETE /inventory/{batch_id}
```

Removes a specific batch from inventory.

#### Smart Consume (FEFO)

```http
POST /inventory/consume
Content-Type: application/json

{
  "item_name": "Milk",
  "amount": 0.5,
  "brand": "A2"  // optional: filter by brand
}
```

**Response:**
```json
{
  "success": true,
  "consumed_amount": 0.5,
  "remaining_to_consume": 0,
  "affected_batches": [
    {"batch_id": 1, "old_qty": 1.5, "new_qty": 1.0, "brand": "A2"}
  ],
  "message": "Successfully consumed 0.5L of Milk"
}
```

### AI Agent Endpoint

#### Process Natural Language Command

```http
POST /agent/action
Content-Type: application/json

{
  "text": "I drank 200ml of milk",
  "thread_id": "optional-uuid",
  "confirm": true  // optional: structured confirmation
}
```

**Response:**
```json
{
  "response": "System will execute:\n1. Consume 0.2L Milk\n   → Batch #1, expires 2026-02-10\n\nConfirm? [Yes/No]",
  "thread_id": "uuid-for-next-request",
  "status": "awaiting_confirm",
  "pending_action": {
    "items": [
      {
        "index": 0,
        "intent": "CONSUME",
        "extracted_info": {"item_name": "Milk", "amount": 0.2},
        "missing_fields": []
      }
    ],
    "confirmation_message": "..."
  },
  "tool_calls": []
}
```

**Status Values:**
| Status             | Description                                     |
| ------------------ | ----------------------------------------------- |
| `completed`        | Operation finished successfully                 |
| `awaiting_info`    | Waiting for user to provide missing information |
| `awaiting_confirm` | Waiting for user confirmation (yes/no)          |

### Transaction Logs

```http
GET /logs?limit=50
```

Returns recent transaction logs for audit trail.

## AI Agent Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Input                                │
│                    "I drank 200ml milk"                         │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Intent_Analyst                                │
│  • Extract intent: CONSUME                                       │
│  • Extract info: {item_name: "Milk", amount: 0.2}               │
│  • Multi-item support: parses "milk and eggs" as 2 operations   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Information_Validator                            │
│  • Check required fields against intent                          │
│  • Route to: ask_more | confirm | execute                        │
└─────────────────────────┬───────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    ┌──────────┐   ┌──────────┐   ┌──────────┐
    │ Ask_More │   │ Confirm  │   │ Execute  │
    │          │   │  (HITL)  │   │          │
    └────┬─────┘   └────┬─────┘   └────┬─────┘
         │              │              │
         │              │              ▼
         │              │       ┌──────────┐
         │              │       │   END    │
         │              │       └──────────┘
         │              │
         └──────────────┴─────► User Response ─────► Loop Back
```

### Nodes

| Node                      | Purpose                                                                              |
| ------------------------- | ------------------------------------------------------------------------------------ |
| **Intent_Analyst**        | Extract intent (ADD/CONSUME/DISCARD/QUERY) and structured info from natural language |
| **Information_Validator** | Check if all required fields are present, determine next step                        |
| **Ask_More**              | Generate follow-up questions for missing information (slot filling)                  |
| **Confirm**               | Show FEFO deduction plan, await human confirmation                                   |
| **Tool_Executor**         | Execute database operations (add/consume/discard/query)                              |

### Required Fields by Intent

| Intent  | Required                               | Optional                  |
| ------- | -------------------------------------- | ------------------------- |
| ADD     | item_name, quantity, unit, expiry_date | brand, category, location |
| CONSUME | item_name, amount                      | brand, unit               |
| DISCARD | batch_id                               | item_name, reason         |
| QUERY   | -                                      | item_name                 |

### Key Features

- **Multi-Item Operations**: Process multiple items in one request
  ```
  User: "I bought milk and eggs, both expire on Feb 15"
  Bot: "Added: 1L Milk, expires 2026-02-15
        Added: 12pcs Eggs, expires 2026-02-15"
  ```

- **Slot Filling**: Incomplete commands trigger follow-up questions
  ```
  User: "I bought chicken wings"
  Bot: "How much chicken wings? And when does it expire?"
  User: "500g, expires Feb 10"
  Bot: "Added: 0.5kg Chicken Wings, expires 2026-02-10"
  ```

- **FEFO Preview**: Shows deduction plan before consuming
  ```
  Bot: "System will execute:
        1. Consume 0.2L Milk
           → Batch #1 (A2), expires 2/5 [FEFO priority]
        Confirm? [Yes/No]"
  ```

- **Correction Detection**: Handles user corrections gracefully
  ```
  User: "I ate 3 eggs and 2 chicken wings"
  Bot: "Confirm: 3 eggs + 2 chicken wings?"
  User: "Wait, I meant 2 eggs"
  Bot: "OK, cancelled. Please tell me the correct operation."
  ```

- **Multi-Turn**: Conversation state preserved via MemorySaver
- **Bilingual**: Responds in user's language (Chinese/English)

## Database Schema

### inventory

| Column       | Type     | Description                             |
| ------------ | -------- | --------------------------------------- |
| id           | Integer  | Primary key, auto-increment             |
| item_name    | String   | Indexed, normalized name (English)      |
| brand        | String?  | "A2", "Coles", etc.                     |
| quantity     | Float    | Current remaining amount                |
| total_volume | Float    | Original package size                   |
| unit         | String   | "L", "kg", "pcs"                        |
| category     | String?  | Meat, Veg, Dairy, Pantry                |
| expiry_date  | Date?    | Critical for FEFO sorting               |
| is_open      | Boolean  | Default False, priority for consumption |
| location     | String   | Fridge, Freezer, Pantry                 |
| created_at   | DateTime | UTC timestamp                           |

### transaction_logs

| Column            | Type     | Description                    |
| ----------------- | -------- | ------------------------------ |
| id                | Integer  | Primary key                    |
| intent            | String   | INBOUND_SCAN, CONSUME, DISCARD |
| raw_input         | Text?    | User's natural language input  |
| ai_reasoning      | Text?    | Chain of thought               |
| operation_details | JSON?    | Affected rows details          |
| timestamp         | DateTime | UTC timestamp                  |

## Project Structure

```
smart-kitchen-core/
├── backend/
│   ├── main.py              # FastAPI app + endpoints
│   ├── database.py          # SQLModel engine + session
│   ├── models.py            # InventoryItem, TransactionLog
│   ├── schemas.py           # Pydantic request/response schemas
│   ├── services.py          # FEFO logic, CRUD operations
│   ├── requirements.txt     # Python dependencies
│   └── agent/
│       ├── __init__.py      # Exports run_agent
│       ├── state.py         # AgentState, PendingAction definitions
│       ├── prompts.py       # LLM prompts for intent analysis
│       ├── nodes.py         # Graph node implementations
│       ├── graph.py         # LangGraph construction + run_agent
│       └── tools.py         # Tool definitions (legacy)
├── docker-compose.yml       # PostgreSQL + API services
├── CLAUDE.md               # AI assistant context
└── README.md               # This file
```

## Development

### Running with Docker

```bash
# Build and start all services
docker-compose up -d --build

# View logs
docker-compose logs -f api

# Restart after code changes
docker-compose restart api
```

### Running Locally

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows

# Install dependencies
pip install -r requirements.txt

# Run server
uvicorn main:app --reload --port 8001
```

### Manual Testing

```bash
# Query inventory
curl http://localhost:8001/api/v1/inventory

# Add item
curl -X POST http://localhost:8001/api/v1/inventory \
  -H "Content-Type: application/json" \
  -d '{"item_name": "Milk", "quantity": 2, "total_volume": 2, "unit": "L", "expiry_date": "2026-02-15"}'

# Natural language command
curl -X POST http://localhost:8001/api/v1/agent/action \
  -H "Content-Type: application/json" \
  -d '{"text": "What do I have in the fridge?"}'

# Multi-item operation
curl -X POST http://localhost:8001/api/v1/agent/action \
  -H "Content-Type: application/json" \
  -d '{"text": "I drank 200ml milk and ate 2 eggs"}'

# Multi-turn conversation
THREAD_ID=$(curl -s -X POST http://localhost:8001/api/v1/agent/action \
  -H "Content-Type: application/json" \
  -d '{"text": "I bought chicken wings"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['thread_id'])")

curl -X POST http://localhost:8001/api/v1/agent/action \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"500g, expires Feb 10\", \"thread_id\": \"$THREAD_ID\"}"
```

### Debug Logging

The agent outputs debug logs to stdout:

```
[Intent_Analyst] Input: {...}
[Intent_Analyst] Output: {...}
[Information_Validator] Routing to: confirm
[TOOL CALL] consume_inventory(item_name=Milk, amount=0.2)
[TOOL RESULT] Consumed 0.2L from batch #1
```

## FEFO Algorithm

The **First Expired, First Out** algorithm ensures optimal inventory rotation:

```python
# Priority 1: Open items first (finish what's started)
# Priority 2: Earliest expiry date (prevent waste)

SELECT * FROM inventory
WHERE item_name = 'Milk'
  AND quantity > 0
ORDER BY
  is_open DESC,           # Open items first
  expiry_date ASC NULLS LAST  # Then by expiry
```

### Cascade Deduction Example

```
Request: Consume 0.5L Milk

Inventory:
  Batch #1: 0.3L, A2, expires 2/5, OPEN
  Batch #2: 1.0L, Coles, expires 2/10, sealed

Result:
  Batch #1: 0.3L → 0L (depleted, closed)
  Batch #2: 1.0L → 0.8L (0.2L consumed)
  Total consumed: 0.5L ✓
```

## Roadmap

- [x] Phase 1: Infrastructure & Schema
- [x] Phase 2: Backend Logic (Smart CRUD, cascading deduction)
- [x] Phase 3: AI Integration (LangGraph state machine)
- [ ] Phase 4: UI (React frontend)
- [ ] Phase 5: Receipt OCR (auto-add from shopping receipts)
- [ ] Phase 6: Meal Planning Integration

## License

MIT

## Author

Ken
