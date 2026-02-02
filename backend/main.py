import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException
from sqlmodel import Session

from database import create_db_and_tables, get_db
from models import InventoryItem, TransactionLog  #Required for table creation
from schemas import (
    InventoryItemCreate,
    InventoryItemResponse,
    InventoryGroupResponse,
    ConsumeRequest,
    ConsumeResult,
    TransactionLogResponse,
    AgentActionRequest,
    AgentActionResponse,
    PendingActionResponse,
    PendingActionItemResponse,
)
from agent import run_agent
from services import (
    add_inventory_item,
    get_inventory_grouped,
    get_all_inventory,
    discard_batch,
    consume_item,
    get_transaction_logs,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events for the application."""
    create_db_and_tables()
    yield


app = FastAPI(title="SmartKitchen Core", lifespan=lifespan)


#Health Check

@app.get("/")
def health_check():
    """Root endpoint: Confirms API is online."""
    db_host = os.getenv("POSTGRES_HOST", "Local/Not Found")
    return {
        "status": "online",
        "service": "SmartKitchen Backend",
        "container_check": {
            "is_running_in_docker": db_host == "db",
            "connected_db_host": db_host,
        },
    }


#Inventory Endpoints

@app.get("/api/v1/inventory", response_model=list[InventoryGroupResponse])
def list_inventory_grouped(db: Session = Depends(get_db)):
    """Get inventory grouped by item name with nested batch details."""
    return get_inventory_grouped(db)


@app.get("/api/v1/inventory/all", response_model=list[InventoryItemResponse])
def list_all_inventory(db: Session = Depends(get_db)):
    """Get all inventory batches (flat list)."""
    return get_all_inventory(db)


@app.post("/api/v1/inventory", response_model=InventoryItemResponse, status_code=201)
def create_inventory_item(item: InventoryItemCreate, db: Session = Depends(get_db)):
    """Add a new inventory batch."""
    return add_inventory_item(db, item)


@app.delete("/api/v1/inventory/{batch_id}")
def delete_inventory_batch(batch_id: int, db: Session = Depends(get_db)):
    """Discard a specific inventory batch."""
    item = discard_batch(db, batch_id)
    if not item:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"message": f"Batch {batch_id} discarded", "item_name": item.item_name}


#Smart Consumption (FEFO)

@app.post("/api/v1/inventory/consume", response_model=ConsumeResult)
def consume_inventory(request: ConsumeRequest, db: Session = Depends(get_db)):
    """
    Smart consumption with FEFO logic.

    - Consumes from open items first
    - Then by earliest expiry date
    - Cascades across batches if needed
    - Optional: specify brand to filter
    """
    result = consume_item(
        db=db,
        item_name=request.item_name,
        amount=request.amount,
        brand=request.brand,
    )
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    return result


#Transaction Logs

@app.get("/api/v1/logs", response_model=list[TransactionLogResponse])
def list_transaction_logs(limit: int = 50, db: Session = Depends(get_db)):
    """Get recent transaction logs for audit trail."""
    return get_transaction_logs(db, limit)


#AI Agent

@app.post("/api/v1/agent/action", response_model=AgentActionResponse)
def agent_action(request: AgentActionRequest):
    """
    Process natural language commands using AI agent.

    Supports multi-turn conversation with slot filling and confirmation.

    For multi-turn:
    - First request: send text, get back thread_id
    - Follow-up: send text + thread_id to continue conversation
    - Confirmation: send confirm=true/false + thread_id
    """
    result = run_agent(
        text=request.text,
        thread_id=request.thread_id,
        confirm_action=request.confirm,
    )

    # Build pending action response if exists (multi-item support)
    pending = None
    if result.get("pending_action"):
        pa = result["pending_action"]
        items = pa.get("items", [])
        pending = PendingActionResponse(
            items=[
                PendingActionItemResponse(
                    index=item.get("index", i),
                    intent=item.get("intent"),
                    extracted_info=item.get("extracted_info"),
                    missing_fields=item.get("missing_fields"),
                )
                for i, item in enumerate(items)
            ] if items else None,
            confirmation_message=pa.get("confirmation_message"),
        )

    return AgentActionResponse(
        response=result.get("response", ""),
        thread_id=result.get("thread_id", ""),
        status=result.get("status", "completed"),
        pending_action=pending,
        tool_calls=result.get("tool_calls", []),
    )

