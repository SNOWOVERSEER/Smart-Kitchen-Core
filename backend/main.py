"""FastAPI application with Supabase Auth and multi-user support."""

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from auth import get_current_user
from database import get_supabase_client, get_supabase_anon_client
from schemas import (
    # Auth
    SignUpRequest, LoginRequest, AuthResponse, SignUpResponse, ProfileResponse, ProfileUpdate,
    # AI Config
    AIConfigCreate, AIConfigResponse,
    # Barcode
    BarcodeResponse, BarcodeProduct,
    # Photo Recognition
    PhotoRecognizeRequest, PhotoRecognizeResponse, RecognizedItem,
    # Inventory
    InventoryItemCreate, InventoryItemUpdate, InventoryItemResponse, InventoryGroupResponse,
    ConsumeRequest, ConsumeResult,
    # Logs
    TransactionLogResponse,
    # Agent
    AgentActionRequest, AgentActionResponse,
    PendingActionResponse, PendingActionItemResponse,
    # Recipes
    GenerateRecipesRequest, GenerateRecipesResponse,
    SaveRecipeRequest, SavedRecipeResponse,
    # Shopping
    ShoppingItemCreate, ShoppingItemUpdate, ShoppingItemResponse,
    CompleteShoppingRequest, CompleteShoppingResult,
)
from barcode import lookup_barcode
from photo_recognize import recognize_image, build_agent_text_from_items
from agent import run_agent
from services import (
    add_inventory_item,
    get_inventory_grouped,
    get_all_inventory,
    discard_batch,
    consume_item,
    update_inventory_item,
    get_transaction_logs,
    generate_recipes,
    save_recipe,
    get_saved_recipes,
    get_saved_recipe,
    delete_saved_recipe,
    get_shopping_items,
    add_shopping_item,
    add_shopping_items_bulk,
    update_shopping_item,
    delete_shopping_item,
    delete_checked_shopping_items,
    complete_shopping,
)


app = FastAPI(title="Kitchen Loop Core")

# CORS for cross-platform frontends
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health Check ──

@app.get("/")
def health_check():
    return {"status": "online", "service": "Kitchen Loop Core"}


# ── Auth Endpoints ──

@app.post("/auth/signup", response_model=SignUpResponse)
def signup(request: SignUpRequest):
    supabase = get_supabase_anon_client()
    try:
        result = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {"data": {"display_name": request.display_name}},
        })
    except Exception as e:
        error_detail = str(e)
        if "already registered" in error_detail.lower():
            raise HTTPException(status_code=409, detail="Email already registered")
        raise HTTPException(status_code=400, detail=error_detail)

    if not result.user:
        raise HTTPException(status_code=400, detail="Signup failed")

    if result.session:
        return SignUpResponse(
            requires_email_verification=False,
            message="Signup successful",
            access_token=result.session.access_token,
            refresh_token=result.session.refresh_token,
            user_id=result.user.id,
            email=result.user.email or request.email,
        )

    return SignUpResponse(
        requires_email_verification=True,
        message="Check your email for confirmation link.",
        user_id=result.user.id,
        email=result.user.email or request.email,
    )


@app.post("/auth/login", response_model=AuthResponse)
def login(request: LoginRequest):
    supabase = get_supabase_anon_client()
    try:
        result = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

    return AuthResponse(
        access_token=result.session.access_token,
        refresh_token=result.session.refresh_token,
        user_id=result.user.id,
        email=result.user.email,
    )


@app.post("/auth/logout")
def logout(user_id: str = Depends(get_current_user)):
    return {"message": "Logged out successfully"}


@app.post("/auth/refresh", response_model=AuthResponse)
def refresh_token(refresh_token: str):
    supabase = get_supabase_anon_client()
    try:
        result = supabase.auth.refresh_session(refresh_token)
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

    return AuthResponse(
        access_token=result.session.access_token,
        refresh_token=result.session.refresh_token,
        user_id=result.user.id,
        email=result.user.email,
    )


@app.get("/auth/me", response_model=ProfileResponse)
def get_profile(user_id: str = Depends(get_current_user)):
    supabase = get_supabase_client()
    result = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
    profile = result.data
    return ProfileResponse(
        id=profile["id"],
        display_name=profile.get("display_name"),
        preferred_language=profile.get("preferred_language", "en"),
    )


@app.patch("/auth/me", response_model=ProfileResponse)
def update_profile(update: ProfileUpdate, user_id: str = Depends(get_current_user)):
    supabase = get_supabase_client()
    data = {k: v for k, v in update.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = supabase.table("profiles").update(data).eq("id", user_id).execute()
    profile = result.data[0]
    return ProfileResponse(
        id=profile["id"],
        display_name=profile.get("display_name"),
        preferred_language=profile.get("preferred_language", "en"),
    )


# ── AI Config Endpoints ──

@app.get("/api/v1/settings/ai", response_model=list[AIConfigResponse])
def list_ai_configs(user_id: str = Depends(get_current_user)):
    supabase = get_supabase_client()
    result = supabase.table("user_ai_configs").select("*").eq("user_id", user_id).execute()
    configs = []
    for row in result.data:
        # Mask API key - get first/last 4 chars
        secret = supabase.rpc("get_decrypted_secret", {"secret_id": row["api_key_secret_id"]}).execute()
        key = secret.data or ""
        preview = f"{key[:7]}...{key[-4:]}" if len(key) > 11 else "****"
        configs.append(AIConfigResponse(
            id=row["id"],
            provider=row["provider"],
            model_id=row["model_id"],
            is_active=row["is_active"],
            api_key_preview=preview,
            created_at=row.get("created_at"),
        ))
    return configs


@app.post("/api/v1/settings/ai", response_model=AIConfigResponse)
def upsert_ai_config(config: AIConfigCreate, user_id: str = Depends(get_current_user)):
    supabase = get_supabase_client()

    # Store API key in Vault
    vault_result = supabase.rpc("vault_create_secret", {"secret": config.api_key}).execute()
    secret_id = vault_result.data

    # Upsert config
    data = {
        "user_id": user_id,
        "provider": config.provider,
        "api_key_secret_id": secret_id,
        "model_id": config.model_id,
        "is_active": True,
    }
    result = supabase.table("user_ai_configs").upsert(
        data, on_conflict="user_id,provider"
    ).execute()

    # Deactivate other providers for this user
    supabase.table("user_ai_configs").update(
        {"is_active": False}
    ).eq("user_id", user_id).neq("provider", config.provider).execute()

    row = result.data[0]
    preview = f"{config.api_key[:7]}...{config.api_key[-4:]}"
    return AIConfigResponse(
        id=row["id"],
        provider=row["provider"],
        model_id=row["model_id"],
        is_active=True,
        api_key_preview=preview,
    )


@app.delete("/api/v1/settings/ai/{provider}")
def delete_ai_config(provider: str, user_id: str = Depends(get_current_user)):
    supabase = get_supabase_client()
    supabase.table("user_ai_configs").delete().eq(
        "user_id", user_id
    ).eq("provider", provider).execute()
    return {"message": f"AI config for {provider} deleted"}


@app.put("/api/v1/settings/ai/{provider}/activate")
def activate_ai_config(provider: str, user_id: str = Depends(get_current_user)):
    supabase = get_supabase_client()
    # Deactivate all
    supabase.table("user_ai_configs").update(
        {"is_active": False}
    ).eq("user_id", user_id).execute()
    # Activate selected
    supabase.table("user_ai_configs").update(
        {"is_active": True}
    ).eq("user_id", user_id).eq("provider", provider).execute()
    return {"message": f"{provider} activated"}


# ── Barcode Lookup ──

@app.get("/api/v1/barcode/{barcode}", response_model=BarcodeResponse)
def barcode_lookup(barcode: str, user_id: str = Depends(get_current_user)):
    result = lookup_barcode(barcode)
    if not result:
        return BarcodeResponse(found=False, barcode=barcode, product=None)
    return BarcodeResponse(
        found=True,
        barcode=barcode,
        product=BarcodeProduct(**result),
    )


# ── Photo Recognition ──

@app.post("/api/v1/agent/photo-recognize", response_model=PhotoRecognizeResponse)
def photo_recognize(request: PhotoRecognizeRequest, user_id: str = Depends(get_current_user)):
    # Step 1: Recognize items in photo
    try:
        recognition = recognize_image(user_id, request.image_base64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    items = recognition.get("items", [])
    description = recognition.get("description", "")

    if not items:
        raise HTTPException(
            status_code=422,
            detail="No grocery items recognized in the photo. Please try again or use manual entry.",
        )

    # Step 2: Convert to text and feed into agent
    agent_text = build_agent_text_from_items(items)
    agent_result = run_agent(
        text=agent_text,
        user_id=user_id,
        thread_id=request.thread_id,
    )

    # Step 3: Build response
    pending = None
    if agent_result.get("pending_action"):
        pa = agent_result["pending_action"]
        pending_items = pa.get("items", [])
        pending = PendingActionResponse(
            items=[
                PendingActionItemResponse(
                    index=item.get("index", i),
                    intent=item.get("intent"),
                    extracted_info=item.get("extracted_info"),
                    missing_fields=item.get("missing_fields"),
                )
                for i, item in enumerate(pending_items)
            ] if pending_items else None,
            confirmation_message=pa.get("confirmation_message"),
        )

    agent_response = AgentActionResponse(
        response=agent_result.get("response", ""),
        thread_id=agent_result.get("thread_id", ""),
        status=agent_result.get("status", "completed"),
        pending_action=pending,
        tool_calls=agent_result.get("tool_calls", []),
    )

    return PhotoRecognizeResponse(
        recognized_items=[RecognizedItem(**item) for item in items],
        description=description,
        agent_response=agent_response,
    )


# ── Inventory Endpoints (auth required) ──

@app.get("/api/v1/inventory", response_model=list[InventoryGroupResponse])
def list_inventory_grouped(user_id: str = Depends(get_current_user)):
    return get_inventory_grouped(user_id)


@app.get("/api/v1/inventory/all", response_model=list[InventoryItemResponse])
def list_all_inventory(user_id: str = Depends(get_current_user)):
    return get_all_inventory(user_id)


@app.post("/api/v1/inventory", response_model=InventoryItemResponse, status_code=201)
def create_inventory_item(item: InventoryItemCreate, user_id: str = Depends(get_current_user)):
    row = add_inventory_item(user_id, item)
    return row


@app.patch("/api/v1/inventory/{batch_id}", response_model=InventoryItemResponse)
def edit_inventory_batch(batch_id: int, update: InventoryItemUpdate, user_id: str = Depends(get_current_user)):
    item = update_inventory_item(user_id, batch_id, update)
    if not item:
        raise HTTPException(status_code=404, detail="Batch not found")
    return item


@app.delete("/api/v1/inventory/{batch_id}")
def delete_inventory_batch(batch_id: int, user_id: str = Depends(get_current_user)):
    item = discard_batch(user_id, batch_id)
    if not item:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"message": f"Batch {batch_id} discarded", "item_name": item["item_name"]}


@app.post("/api/v1/inventory/consume", response_model=ConsumeResult)
def consume_inventory(request: ConsumeRequest, user_id: str = Depends(get_current_user)):
    result = consume_item(user_id, request.item_name, request.amount, request.brand)
    if not result.success:
        raise HTTPException(status_code=400, detail=result.message)
    return result


# ── Transaction Logs ──

@app.get("/api/v1/logs", response_model=list[TransactionLogResponse])
def list_transaction_logs(limit: int = 50, user_id: str = Depends(get_current_user)):
    return get_transaction_logs(user_id, limit)


# ── AI Agent ──

@app.post("/api/v1/agent/action", response_model=AgentActionResponse)
def agent_action(request: AgentActionRequest, user_id: str = Depends(get_current_user)):
    result = run_agent(
        text=request.text,
        user_id=user_id,
        thread_id=request.thread_id,
        confirm_action=request.confirm,
    )

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


# ── Recipe endpoints ──

@app.post("/api/v1/recipes/generate", response_model=GenerateRecipesResponse)
def generate_recipes_endpoint(
    request: GenerateRecipesRequest,
    user_id: str = Depends(get_current_user),
) -> GenerateRecipesResponse:
    try:
        result = generate_recipes(
            user_id=user_id,
            mode=request.mode,
            prompt=request.prompt,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/recipes", response_model=SavedRecipeResponse, status_code=201)
def save_recipe_endpoint(
    request: SaveRecipeRequest,
    user_id: str = Depends(get_current_user),
) -> SavedRecipeResponse:
    row = save_recipe(
        user_id=user_id,
        recipe=request.recipe.model_dump(),
        source_mode=request.source_mode,
        source_prompt=request.source_prompt,
    )
    return row


@app.get("/api/v1/recipes", response_model=list[SavedRecipeResponse])
def list_recipes_endpoint(
    limit: int = 20,
    offset: int = 0,
    user_id: str = Depends(get_current_user),
) -> list[SavedRecipeResponse]:
    return get_saved_recipes(user_id, limit=limit, offset=offset)


@app.get("/api/v1/recipes/{recipe_id}", response_model=SavedRecipeResponse)
def get_recipe_endpoint(
    recipe_id: int,
    user_id: str = Depends(get_current_user),
) -> SavedRecipeResponse:
    recipe = get_saved_recipe(user_id, recipe_id)
    if not recipe:
        raise HTTPException(status_code=404, detail="Recipe not found")
    return recipe


@app.delete("/api/v1/recipes/{recipe_id}")
def delete_recipe_endpoint(
    recipe_id: int,
    user_id: str = Depends(get_current_user),
) -> dict:
    if not delete_saved_recipe(user_id, recipe_id):
        raise HTTPException(status_code=404, detail="Recipe not found")
    return {"message": "Recipe deleted"}


# ── Shopping list endpoints ──

@app.get("/api/v1/shopping", response_model=list[ShoppingItemResponse])
def list_shopping_items(user_id: str = Depends(get_current_user)) -> list[ShoppingItemResponse]:
    return get_shopping_items(user_id)


@app.post("/api/v1/shopping", response_model=ShoppingItemResponse, status_code=201)
def add_shopping_item_endpoint(
    item: ShoppingItemCreate,
    user_id: str = Depends(get_current_user),
) -> ShoppingItemResponse:
    return add_shopping_item(user_id, item)


@app.post("/api/v1/shopping/bulk", response_model=list[ShoppingItemResponse], status_code=201)
def add_shopping_items_bulk_endpoint(
    items: list[ShoppingItemCreate],
    user_id: str = Depends(get_current_user),
) -> list[ShoppingItemResponse]:
    return add_shopping_items_bulk(user_id, items)


@app.post("/api/v1/shopping/complete", response_model=CompleteShoppingResult)
def complete_shopping_endpoint(
    request: CompleteShoppingRequest,
    user_id: str = Depends(get_current_user),
) -> CompleteShoppingResult:
    return complete_shopping(
        user_id=user_id,
        item_ids=request.item_ids,
        default_location=request.default_location,
    )


@app.patch("/api/v1/shopping/{item_id}", response_model=ShoppingItemResponse)
def update_shopping_item_endpoint(
    item_id: int,
    update: ShoppingItemUpdate,
    user_id: str = Depends(get_current_user),
) -> ShoppingItemResponse:
    result = update_shopping_item(user_id, item_id, update)
    if not result:
        raise HTTPException(status_code=404, detail="Item not found")
    return result


@app.delete("/api/v1/shopping/checked")
def delete_checked_items_endpoint(user_id: str = Depends(get_current_user)) -> dict:
    count = delete_checked_shopping_items(user_id)
    return {"deleted_count": count}


@app.delete("/api/v1/shopping/{item_id}")
def delete_shopping_item_endpoint(
    item_id: int,
    user_id: str = Depends(get_current_user),
) -> dict:
    if not delete_shopping_item(user_id, item_id):
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Item deleted"}
