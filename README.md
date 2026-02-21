# Kitchen Loop Core

An intelligent kitchen inventory management system with batch-level tracking, natural language processing, and multi-user support.

## Highlights

- **Batch-Level Tracking**: Every inventory entry is a distinct "Batch" with its own expiry date, brand, and quantity
- **FEFO Logic**: First Expired, First Out — automatically prioritizes open and soonest-expiring items
- **AI-Powered Agent**: Natural language interface (Chinese + English) using a tool-calling ReAct loop
- **Human-in-the-Loop**: Preview + confirmation before any write operation (consume/discard/update)
- **Multi-Turn Conversations**: Conversation state persisted via Supabase checkpointing
- **Per-User AI Keys**: Users bring their own OpenAI or Anthropic API key (encrypted in Supabase Vault)
- **Multi-User**: Supabase Auth with email/password JWT; all data scoped by Row-Level Security
- **Bilingual UI**: Full EN/ZH i18n; language switches instantly from Settings

## Tech Stack

| Layer        | Technology                                         |
| ------------ | -------------------------------------------------- |
| Frontend     | React 19 + TypeScript + Vite 6                     |
| UI           | Tailwind CSS v4 + shadcn/ui + Framer Motion        |
| Routing      | TanStack Router v1 (file-based)                    |
| Server State | TanStack Query v5                                  |
| Client State | Zustand v5                                         |
| i18n         | react-i18next (EN / ZH)                            |
| Backend      | Python 3.11+ / FastAPI                             |
| Database     | Supabase (Hosted PostgreSQL + Auth + Vault)        |
| Auth         | Supabase Auth (email/password JWT)                 |
| AI Framework | LangChain / LangGraph (tool-calling ReAct)         |
| LLM          | OpenAI GPT-4o / Anthropic Claude (per-user config) |

## Quick Start

### Prerequisites

- Docker & Docker Compose
- A Supabase project ([supabase.com](https://supabase.com))
- OpenAI or Anthropic API key (users can also bring their own via Settings)

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

### 4. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`

### 5. Verify Installation

```bash
curl http://localhost:8001/
# {"status": "online", "service": "Kitchen Loop Core"}
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

```http
POST /auth/signup       {"email", "password", "display_name"}
POST /auth/login        {"email", "password"}
POST /auth/refresh      ?refresh_token=<token>
POST /auth/logout
GET  /auth/me
PATCH /auth/me          {"display_name", "preferred_language"}
```

### AI Settings

```http
GET    /api/v1/settings/ai
POST   /api/v1/settings/ai              {"provider", "api_key", "model_id"}
PUT    /api/v1/settings/ai/{provider}/activate
DELETE /api/v1/settings/ai/{provider}
```

API keys are encrypted in Supabase Vault and never returned in plaintext.

### Inventory

```http
GET    /api/v1/inventory                # Grouped by item name
GET    /api/v1/inventory/all            # Flat batch list
POST   /api/v1/inventory                # Add batch
PATCH  /api/v1/inventory/{batch_id}     # Update batch fields
DELETE /api/v1/inventory/{batch_id}     # Discard batch
POST   /api/v1/inventory/consume        # FEFO consumption
```

**Add batch request:**
```json
{
  "item_name": "Milk",
  "brand": "A2",
  "quantity": 2.0,
  "total_volume": 2.0,
  "unit": "L",
  "category": "Dairy",
  "expiry_date": "2026-03-01",
  "is_open": false,
  "location": "Fridge"
}
```

**Grouped inventory response:**
```json
[
  {
    "item_name": "Milk",
    "total_quantity": 2.5,
    "unit": "L",
    "batches": [
      {
        "id": 42,
        "brand": "A2",
        "quantity": 1.5,
        "total_volume": 2.0,
        "unit": "L",
        "expiry_date": "2026-03-01",
        "is_open": true,
        "location": "Fridge"
      }
    ]
  }
]
```

### AI Agent

```http
POST /api/v1/agent/action
```

```json
{
  "text": "I drank 200ml of milk",
  "thread_id": "optional-uuid",
  "confirm": false
}
```

**Response:**
```json
{
  "response": "Found 2L A2 Milk in fridge (expires Mar 1). Consume 200ml from batch #42?\n\nConfirm?",
  "thread_id": "uuid-for-next-request",
  "status": "awaiting_confirm",
  "pending_action": { "..." : "..." },
  "tool_calls": []
}
```

**Status values:**

| Status             | Meaning                                         |
| ------------------ | ----------------------------------------------- |
| `completed`        | Operation finished                              |
| `awaiting_info`    | Agent needs more information from user          |
| `awaiting_confirm` | Previewing write operation, waiting for yes/no  |

### Other Endpoints

```http
GET  /api/v1/logs?limit=50              # Transaction history
GET  /api/v1/barcode/{barcode}          # OpenFoodFacts product lookup
POST /api/v1/agent/photo-recognize      # Recognize groceries from photo (base64)
```

## AI Agent Architecture

The agent is a **tool-calling ReAct loop** (LangGraph). The LLM picks from defined tools via native function calling; write operations require a preview + confirmation.

```
User Input
    ↓
handle_input
    ↓
agent_node  ←──────────────┐
    ↓                       │
route_agent                  │
    ├── read tool?  → execute_read ─┘  (loop back with results)
    ├── write tool? → build_preview → respond  (return preview for confirmation)
    └── no tools?   → respond  (return final answer)

User confirms → execute_write → respond
```

### Tools

| Tool | Type | Description |
|---|---|---|
| `search_inventory` | Read | Case-insensitive search by name/brand/location |
| `get_batch_details` | Read | Fetch single batch by ID |
| `add_item` | Write | Add new batch |
| `consume_item` | Write | FEFO deduction across batches |
| `discard_batch` | Write | Remove a batch |
| `update_item` | Write | Change location, is_open, quantity, or expiry |

### Key Behaviors

- **Search before write**: Agent always searches inventory before consuming or updating
- **FEFO**: Open items consumed first, then earliest expiry
- **Case-insensitive**: All brand/item_name matching uses `.ilike()`
- **Category inference**: Infers category from item name when not specified
- **Bilingual**: Responds in user's language; internal DB values stay English
- **Per-user LLM**: Each user configures their own AI provider and API key

## FEFO Algorithm

```sql
SELECT * FROM inventory
WHERE item_name ILIKE 'Milk'
  AND user_id = '<current_user>'
  AND quantity > 0
ORDER BY
  is_open DESC,                -- Open items first
  expiry_date ASC NULLS LAST   -- Then by soonest expiry
```

**Cascade deduction example:**

```
Consume 0.5L Milk

Inventory:
  Batch #41: 0.3L A2, expires Feb 5, OPEN    ← priority 1
  Batch #42: 1.0L Coles, expires Feb 10, sealed

Result:
  Batch #41: 0.3L → 0L (depleted)
  Batch #42: 1.0L → 0.8L (opened, 0.2L consumed)
  Total consumed: 0.5L ✓
```

## Database Schema

| Table                 | Purpose                                |
| --------------------- | -------------------------------------- |
| `profiles`            | User profiles (auto-created on signup) |
| `user_ai_configs`     | Per-user AI provider + encrypted key   |
| `inventory`           | Inventory batches (RLS scoped)         |
| `transaction_logs`    | Audit trail — INBOUND/CONSUME/DISCARD/UPDATE |
| `agent_conversations` | Multi-turn conversation checkpoints    |

All tables have Row-Level Security. API keys are stored encrypted in Supabase Vault.

## Project Structure

```
smart-kitchen-core/
├── backend/
│   ├── main.py              # FastAPI app + all endpoints
│   ├── config.py            # Environment variables
│   ├── database.py          # Supabase client
│   ├── auth.py              # JWT middleware
│   ├── models.py            # Pydantic table models
│   ├── schemas.py           # Request/response schemas
│   ├── services.py          # FEFO logic, CRUD (case-insensitive matching)
│   ├── barcode.py           # OpenFoodFacts lookup
│   ├── photo_recognize.py   # Multimodal photo recognition
│   ├── requirements.txt
│   ├── Dockerfile
│   └── agent/
│       ├── __init__.py      # Exports run_agent
│       ├── state.py         # AgentState (messages, pending_writes, status)
│       ├── prompt.py        # Single SYSTEM_PROMPT
│       ├── tools.py         # Tool definitions (search, add, consume, update, discard)
│       ├── nodes.py         # Graph nodes (handle_input, agent, execute_read, etc.)
│       ├── graph.py         # LangGraph wiring + SupabaseCheckpointer
│       └── llm_factory.py   # Multi-provider LLM factory
├── frontend/
│   └── src/
│       ├── features/
│       │   ├── auth/        # Login, Signup
│       │   ├── inventory/   # Dashboard, item cards, add/edit/consume sheets
│       │   ├── chat/        # Agent drawer (desktop) + chat page (mobile)
│       │   ├── history/     # Transaction log with filters + export
│       │   ├── barcode/     # Camera scanner + product lookup
│       │   └── settings/    # Profile, language, AI provider config
│       ├── shared/
│       │   ├── lib/
│       │   │   ├── axios.ts       # JWT interceptor + auto-refresh
│       │   │   ├── api.types.ts   # Shared TS types
│       │   │   ├── utils.ts       # formatQuantity, expiryStatus
│       │   │   └── i18n/          # en.json, zh.json, index.ts
│       │   ├── components/  # Sidebar, BottomNav, TopBar, FABChatButton
│       │   ├── hooks/       # useMediaQuery
│       │   └── stores/      # authStore (Zustand)
│       └── routes/          # TanStack Router file-based routes
├── docker-compose.yml
└── README.md
```

## Development

### Frontend

```bash
cd frontend
npm run dev        # Dev server at localhost:5173 (proxies /api + /auth to :8001)
npm run build      # Production build
npm run typecheck  # TypeScript check
```

Frontend env file:

```env
# frontend/.env.local
VITE_API_URL=http://localhost:8001
```

**Key patterns:**
- `access_token` stored in Zustand memory; `refresh_token` in `localStorage` (`sk_refresh_token`)
- 401 auto-refresh handled in `src/shared/lib/axios.ts`
- UI language syncs automatically from `profile.preferred_language` via `TopBar`
- Never edit `src/routeTree.gen.ts` — it is auto-generated by the TanStack Router Vite plugin
- Use Tailwind responsive prefixes (`sm:`, `lg:`) for layout, not `useMediaQuery`

### Backend (Docker)

```bash
docker-compose up -d --build   # Build and start
docker-compose logs -f api     # Stream logs
docker-compose restart api     # Restart after changes
```

### Manual API Testing

```bash
# Sign up and capture token
TOKEN=$(curl -s -X POST http://localhost:8001/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test1234","display_name":"Test"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")

# Add inventory
curl -X POST http://localhost:8001/api/v1/inventory \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"item_name":"Milk","quantity":2,"total_volume":2,"unit":"L","expiry_date":"2026-03-01","location":"Fridge"}'

# Natural language command
curl -X POST http://localhost:8001/api/v1/agent/action \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"text":"What do I have in the fridge?"}'
```

## License

MIT

## Author

Ken
