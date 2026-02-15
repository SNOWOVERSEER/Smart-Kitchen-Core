# SmartKitchen Core

An intelligent kitchen inventory management system with batch-level tracking, natural language processing, and multi-user support.

## Highlights

- **Multi-User**: Supabase Auth with email/password, JWT-based API access
- **Batch-Level Tracking**: Every inventory entry is a distinct "Batch" with its own expiry date, brand, and quantity
- **FEFO Logic**: First Expired, First Out - automatically prioritizes consuming items that expire soonest
- **AI-Powered**: Natural language interface supporting both Chinese and English
- **Per-User AI Keys**: Users can bring their own OpenAI or Anthropic API key (encrypted in Vault)
- **Multi-Item Operations**: Process multiple items in one command ("I drank milk and ate 3 eggs")
- **Human-in-the-Loop**: Confirmation flow before destructive operations (consume/discard)
- **Multi-Turn Conversations**: Slot filling for incomplete commands with correction detection
- **Row-Level Security**: All data access is scoped to the authenticated user

## Tech Stack

| Layer        | Technology                                         |
| ------------ | -------------------------------------------------- |
| Backend      | Python 3.11+ / FastAPI                             |
| Database     | Supabase (Hosted PostgreSQL + Auth + Vault)        |
| Auth         | Supabase Auth (email/password JWT)                 |
| AI Framework | LangChain / LangGraph                              |
| LLM          | OpenAI GPT-4o / Anthropic Claude (per-user config) |
| Frontend     | React + TypeScript + Tailwind (Phase 4)            |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- A Supabase project ([supabase.com](https://supabase.com))
- OpenAI API Key (optional fallback if users don't bring their own)

### 1. Clone and Setup

```bash
git clone https://github.com/yourusername/smart-kitchen-core.git
cd smart-kitchen-core
```

### 2. Environment Variables

Create a `.env` file in the project root:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
SUPABASE_SECRET_KEY=sb_secret_your-key

# Default LLM (fallback for users without their own key)
OPENAI_API_KEY=sk-your-key-here
```

> Get your keys from Supabase Dashboard > Settings > API Keys

### 3. Start the API

```bash
docker-compose up -d --build
```

The API will be available at `http://localhost:8001`

### 4. Verify Installation

```bash
curl http://localhost:8001/
# {"status": "online", "service": "SmartKitchen Core"}
```

## API Reference

### Base URL

```
http://localhost:8001
```

### Authentication

All endpoints (except `/auth/signup` and `/auth/login`) require a JWT token:

```
Authorization: Bearer <access_token>
```

### Auth Endpoints

#### Sign Up

```http
POST /auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure123",
  "display_name": "Ken"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "...",
  "user_id": "uuid",
  "email": "user@example.com"
}
```

#### Login

```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure123"
}
```

#### Refresh Token

```http
POST /auth/refresh?refresh_token=<token>
```

#### Get / Update Profile

```http
GET /auth/me
PATCH /auth/me  {"display_name": "New Name", "preferred_language": "zh"}
```

### AI Settings Endpoints

Users can configure their own AI provider and API key.

#### List AI Configs

```http
GET /api/v1/settings/ai
```

**Response:**
```json
[
  {
    "id": "uuid",
    "provider": "openai",
    "model_id": "gpt-4o",
    "is_active": true,
    "api_key_preview": "sk-proj...abcd"
  }
]
```

#### Add / Update AI Config

```http
POST /api/v1/settings/ai
Content-Type: application/json

{
  "provider": "openai",
  "api_key": "sk-proj-your-key",
  "model_id": "gpt-4o"
}
```

The API key is encrypted and stored in Supabase Vault. Only a masked preview is ever returned.

#### Switch Active Provider

```http
PUT /api/v1/settings/ai/anthropic/activate
```

#### Delete AI Config

```http
DELETE /api/v1/settings/ai/openai
```

### Inventory Endpoints

#### List Inventory (Grouped)

```http
GET /api/v1/inventory
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
GET /api/v1/inventory/all
```

#### Add Inventory

```http
POST /api/v1/inventory
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

> `location` is a required field (Fridge, Freezer, or Pantry).

#### Discard Batch

```http
DELETE /api/v1/inventory/{batch_id}
```

#### Smart Consume (FEFO)

```http
POST /api/v1/inventory/consume
Content-Type: application/json

{
  "item_name": "Milk",
  "amount": 0.5,
  "brand": "A2"
}
```

**Response:**
```json
{
  "success": true,
  "consumed_amount": 0.5,
  "remaining_to_consume": 0,
  "affected_batches": [
    {"batch_id": 1, "old_quantity": 1.5, "new_quantity": 1.0, "brand": "A2"}
  ],
  "message": "Successfully consumed 0.5 Milk"
}
```

### AI Agent Endpoint

#### Process Natural Language Command

```http
POST /api/v1/agent/action
Content-Type: application/json

{
  "text": "I drank 200ml of milk",
  "thread_id": "optional-uuid",
  "confirm": true
}
```

**Response:**
```json
{
  "response": "System will execute:\n1. Consume 0.2L Milk\n   -> Batch #1, expires 2026-02-10\n\nConfirm? [Yes/No]",
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
GET /api/v1/logs?limit=50
```

## AI Agent Architecture

```
                        User Input
                    "I drank 200ml milk"
                            |
                            v
                    +-----------------+
                    | Intent_Analyst  |
                    | - Extract intent|
                    | - Extract info  |
                    +-----------------+
                            |
                            v
                  +---------------------+
                  |Information_Validator|
                  | - Check required    |
                  | - Route next step   |
                  +---------------------+
                            |
          +-----------------+-----------------+
          v                 v                 v
    +----------+      +----------+      +----------+
    | Ask_More |      | Confirm  |      | Execute  |
    |          |      |  (HITL)  |      |          |
    +----+-----+      +----+-----+      +----+-----+
         |                 |                  |
         |                 |                  v
         |                 |              +------+
         |                 |              | END  |
         |                 |              +------+
         |                 |
         +--------+--------+
                  v
           User Response --> Loop Back
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

| Intent  | Required                                         | Optional          |
| ------- | ------------------------------------------------ | ----------------- |
| ADD     | item_name, quantity, unit, expiry_date, location | brand, category   |
| CONSUME | item_name, amount                                | brand, unit       |
| DISCARD | batch_id                                         | item_name, reason |
| QUERY   | -                                                | item_name         |

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
  Bot: "How much? When does it expire? Where to store?"
  User: "500g, expires Feb 10, in the freezer"
  Bot: "Added: 0.5kg Chicken Wings, expires 2026-02-10, Freezer"
  ```

- **FEFO Preview**: Shows deduction plan before consuming
  ```
  Bot: "System will execute:
        1. Consume 0.2L Milk
           -> Batch #1 (A2), expires 2/5 [FEFO priority]
        Confirm? [Yes/No]"
  ```

- **Correction Detection**: Handles user corrections gracefully
  ```
  User: "I ate 3 eggs and 2 chicken wings"
  Bot: "Confirm: 3 eggs + 2 chicken wings?"
  User: "Wait, I meant 2 eggs"
  Bot: "OK, cancelled. Please tell me the correct operation."
  ```

- **Per-User AI**: Each user configures their own LLM provider and API key
- **Multi-Turn**: Conversation state persisted via SupabaseCheckpointer
- **Bilingual**: Responds in user's language (Chinese/English)

## Database Schema

### Supabase Tables

| Table                 | Purpose                                |
| --------------------- | -------------------------------------- |
| `profiles`            | User profiles (auto-created on signup) |
| `user_ai_configs`     | Per-user AI provider settings          |
| `inventory`           | Inventory batches (user-scoped)        |
| `transaction_logs`    | Audit trail (user-scoped)              |
| `agent_conversations` | Multi-turn conversation checkpoints    |

All tables have Row-Level Security (RLS) enabled. Users can only read/write their own data.

API keys are encrypted using Supabase Vault and never stored in plaintext.

## Project Structure

```
smart-kitchen-core/
├── backend/
│   ├── main.py              # FastAPI app + all endpoints
│   ├── config.py            # Environment variable configuration
│   ├── database.py          # Supabase client initialization
│   ├── auth.py              # JWT auth middleware
│   ├── models.py            # Pydantic models (Supabase table schemas)
│   ├── schemas.py           # Request/response validation schemas
│   ├── services.py          # FEFO logic, CRUD operations
│   ├── requirements.txt     # Python dependencies
│   ├── Dockerfile           # Python 3.11-slim container
│   └── agent/
│       ├── __init__.py      # Exports run_agent
│       ├── state.py         # AgentState, PendingAction definitions
│       ├── prompts.py       # LLM prompts for intent analysis
│       ├── nodes.py         # Graph node implementations
│       ├── graph.py         # LangGraph + SupabaseCheckpointer
│       └── llm_factory.py   # Multi-provider LLM factory
├── docker-compose.yml       # API service
└── README.md               # This file
```

## Development

### Running with Docker

```bash
# Build and start
docker-compose up -d --build

# View logs
docker-compose logs -f api

# Restart after code changes (hot-reload enabled)
docker-compose restart api
```

### Manual Testing

```bash
# 1. Sign up
TOKEN=$(curl -s -X POST http://localhost:8001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "test123", "display_name": "Test"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# 2. Check profile
curl http://localhost:8001/auth/me \
  -H "Authorization: Bearer $TOKEN"

# 3. Add inventory
curl -X POST http://localhost:8001/api/v1/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"item_name": "Milk", "quantity": 2, "total_volume": 2, "unit": "L", "expiry_date": "2026-02-20", "location": "Fridge"}'

# 4. Query inventory
curl http://localhost:8001/api/v1/inventory \
  -H "Authorization: Bearer $TOKEN"

# 5. Natural language command
curl -X POST http://localhost:8001/api/v1/agent/action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"text": "What do I have in the fridge?"}'

# 6. Multi-turn conversation
THREAD_ID=$(curl -s -X POST http://localhost:8001/api/v1/agent/action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"text": "I bought chicken wings"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['thread_id'])")

curl -X POST http://localhost:8001/api/v1/agent/action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"text\": \"500g, expires Feb 10, in the freezer\", \"thread_id\": \"$THREAD_ID\"}"

# 7. Configure your own AI key
curl -X POST http://localhost:8001/api/v1/settings/ai \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"provider": "openai", "api_key": "sk-proj-your-key", "model_id": "gpt-4o"}'
```

### Debug Logging

The agent outputs debug logs to stdout:

```
[Intent_Analyst] Input: {...}
[Intent_Analyst] Output: {...}
[Information_Validator] Routing to: confirm
[TOOL CALL] consume_inventory(item_name=Milk, amount=0.2)
[TOOL RESULT] Consumed 0.2L from batch #1
[CLEANUP] Thread abc123 checkpoint cleared
```

## FEFO Algorithm

The **First Expired, First Out** algorithm ensures optimal inventory rotation:

```sql
SELECT * FROM inventory
WHERE item_name = 'Milk'
  AND user_id = '<current_user>'
  AND quantity > 0
ORDER BY
  is_open DESC,                -- Open items first
  expiry_date ASC NULLS LAST   -- Then by expiry
```

### Cascade Deduction Example

```
Request: Consume 0.5L Milk

Inventory:
  Batch #1: 0.3L, A2, expires 2/5, OPEN
  Batch #2: 1.0L, Coles, expires 2/10, sealed

Result:
  Batch #1: 0.3L -> 0L (depleted, closed)
  Batch #2: 1.0L -> 0.8L (0.2L consumed, marked OPEN)
  Total consumed: 0.5L
```


## License

MIT

## Author

Ken
