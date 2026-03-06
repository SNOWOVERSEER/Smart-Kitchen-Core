"""Pydantic schemas for API request/response validation."""

from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# ── Auth Schemas ──

class SignUpRequest(BaseModel):
    email: str = Field(..., description="User email")
    password: str = Field(..., min_length=6, description="Password (min 6 chars)")
    display_name: str | None = Field(None, description="Optional display name")

class LoginRequest(BaseModel):
    email: str
    password: str

class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    user_id: str
    email: str

class SignUpResponse(BaseModel):
    requires_email_verification: bool
    message: str
    access_token: str | None = None
    refresh_token: str | None = None
    user_id: str | None = None
    email: str

class ProfileResponse(BaseModel):
    id: str
    email: str | None = None
    display_name: str | None = None
    preferred_language: str = "en"
    assume_pantry_basics: bool = True

class ProfileUpdate(BaseModel):
    display_name: str | None = None
    preferred_language: str | None = None
    assume_pantry_basics: bool | None = None


# ── AI Config Schemas ──

class AIConfigCreate(BaseModel):
    provider: str = Field(..., description="'openai' or 'anthropic'")
    api_key: str = Field(..., description="API key (will be encrypted)")
    model_id: str = Field(..., description="e.g. 'gpt-4o', 'claude-sonnet-4-5-20250929'")

class AIConfigResponse(BaseModel):
    id: str
    provider: str
    model_id: str
    is_active: bool
    api_key_preview: str  # "sk-...abc" (masked)
    created_at: datetime | None = None


# ── Barcode Schemas ──

class BarcodeProduct(BaseModel):
    item_name: str
    brand: str | None = None
    category: str | None = None
    unit: str = "pcs"
    default_quantity: float | None = None
    image_url: str | None = None

class BarcodeResponse(BaseModel):
    found: bool
    barcode: str
    product: BarcodeProduct | None = None


# ── Photo Recognition Schemas ──

class RecognizedItem(BaseModel):
    item_name: str
    brand: str | None = None
    quantity: float = 1.0
    unit: str = "pcs"
    category: str | None = None
    confidence: str = "medium"

class PhotoRecognizeRequest(BaseModel):
    image_base64: str = Field(..., description="Base64-encoded image (with or without data URI prefix)")
    thread_id: str | None = Field(None, description="Thread ID for continuing conversation")


# ── Inventory Schemas ──

class InventoryItemCreate(BaseModel):
    item_name: str = Field(..., min_length=1, description="Normalized item name")
    brand: str | None = None
    quantity: float = Field(..., gt=0)
    total_volume: float = Field(..., gt=0)
    unit: str = Field(..., min_length=1)
    category: str | None = None
    expiry_date: date | None = None
    is_open: bool = False
    location: str = Field(..., min_length=1, description="Fridge, Freezer, or Pantry")

class InventoryItemResponse(BaseModel):
    id: str
    item_name: str
    brand: str | None
    quantity: float
    total_volume: float
    unit: str
    category: str | None
    expiry_date: date | None
    is_open: bool
    location: str
    created_at: datetime | None

class InventoryGroupResponse(BaseModel):
    item_name: str
    total_quantity: float
    unit: str
    batches: list[InventoryItemResponse]

class InventoryItemUpdate(BaseModel):
    quantity: float | None = None
    total_volume: float | None = None
    unit: str | None = None
    brand: str | None = None
    category: str | None = None
    expiry_date: date | None = None
    is_open: bool | None = None
    location: str | None = None


# ── Consumption Schemas ──

class ConsumeRequest(BaseModel):
    item_name: str = Field(..., description="Item to consume")
    amount: float = Field(..., gt=0, description="Amount to consume")
    brand: str | None = Field(None, description="Optional: specific brand")
    source: str = Field("manual", description="Source: manual, agent, meal, shopping")

class ConsumeResult(BaseModel):
    success: bool
    consumed_amount: float
    remaining_to_consume: float
    affected_batches: list[dict[str, Any]]
    message: str


# ── Transaction Log Schemas ──

class TransactionLogResponse(BaseModel):
    id: str
    intent: str
    raw_input: str | None
    ai_reasoning: str | None
    operation_details: dict[str, Any] | None
    created_at: datetime | None


# ── Agent Schemas ──

class AgentActionRequest(BaseModel):
    text: str = Field(default="", description="Natural language command")
    thread_id: str | None = Field(None, description="Thread ID for conversation continuity")
    confirm: bool | None = Field(None, description="Explicit confirmation")

class PendingActionItemResponse(BaseModel):
    index: int = 0
    intent: str | None = None
    extracted_info: dict[str, Any] | None = None
    missing_fields: list[str] | None = None

class PendingActionResponse(BaseModel):
    items: list[PendingActionItemResponse] | None = None
    confirmation_message: str | None = None

class AgentActionResponse(BaseModel):
    response: str = Field(..., description="Agent's response message")
    thread_id: str = Field(..., description="Thread ID for next request")
    status: str = Field(..., description="completed | awaiting_info | awaiting_confirm")
    pending_action: PendingActionResponse | None = None
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    pending_recipes: list[dict[str, Any]] | None = None


# ── Photo Recognition Response (after AgentActionResponse to avoid forward ref) ──

class PhotoRecognizeResponse(BaseModel):
    recognized_items: list[RecognizedItem]
    description: str
    agent_response: AgentActionResponse


# ── Recipe schemas ──

class RecipeIngredient(BaseModel):
    name: str
    quantity: float | None = None
    unit: str | None = None
    have_in_stock: bool = False
    batch_ids: list[str] = Field(default_factory=list)
    # Coverage ratio: available / required (only set when have_in_stock=False and quantity is comparable)
    coverage_ratio: float | None = None

class RecipeCard(BaseModel):
    title: str
    description: str
    cook_time_min: int | None = None
    servings: int | None = None
    ingredients: list[RecipeIngredient]
    instructions: list[str]
    tags: list[str] = Field(default_factory=list)
    image_prompt: str | None = None
    image_url: str | None = None

class GenerateRecipesRequest(BaseModel):
    categories: list[str] = Field(default_factory=list)
    use_expiring: bool = False
    prompt: str | None = None
    count: int | None = Field(None, ge=1, le=12, description="Number of recipes (default 4)")
    as_meal_set: bool = False
    # Legacy — kept for backward compat until frontend migrates
    mode: str | None = None

class GenerateRecipesResponse(BaseModel):
    recipes: list[RecipeCard]
    feasibility_notice: str | None = None

class SaveRecipeRequest(BaseModel):
    recipe: RecipeCard
    source_mode: str
    source_prompt: str | None = None
    image_prompt: str | None = None

class SavedRecipeResponse(BaseModel):
    id: str
    title: str
    description: str | None
    cook_time_min: int | None
    servings: int | None
    ingredients: list[RecipeIngredient]
    instructions: list[str]
    tags: list[str]
    source_mode: str
    source_prompt: str | None
    image_url: str | None = None
    image_prompt: str | None = None
    created_at: datetime


# ── Shopping schemas ──

class ShoppingItemCreate(BaseModel):
    item_name: str = Field(..., min_length=1)
    brand: str | None = None
    quantity: float | None = None
    unit: str | None = None
    category: str | None = None
    source: Literal['manual', 'recipe', 'agent'] = 'manual'
    source_recipe_id: str | None = None
    source_recipe_title: str | None = None
    note: str | None = None

class ShoppingItemUpdate(BaseModel):
    item_name: str | None = None
    brand: str | None = None
    quantity: float | None = None
    unit: str | None = None
    category: str | None = None
    is_checked: bool | None = None
    note: str | None = None

class ShoppingItemResponse(BaseModel):
    id: str
    item_name: str
    brand: str | None
    quantity: float | None
    unit: str | None
    category: str | None
    is_checked: bool
    source: str
    source_recipe_id: str | None
    source_recipe_title: str | None
    note: str | None
    created_at: datetime
    updated_at: datetime

class CompleteShoppingRequest(BaseModel):
    item_ids: list[str]
    default_location: str = "Fridge"

class CompleteShoppingResult(BaseModel):
    added_count: int
    failed_items: list[str]
    inventory_ids: list[str]


# ── Meal schemas ──

class MealCreate(BaseModel):
    name: str = Field(..., min_length=1)
    scheduled_date: date | None = None
    meal_type: Literal['breakfast', 'lunch', 'dinner', 'snack'] | None = None
    notes: str | None = None
    recipe_ids: list[str] = Field(default_factory=list)
    is_template: bool = False

class MealUpdate(BaseModel):
    name: str | None = None
    scheduled_date: date | None = None
    meal_type: Literal['breakfast', 'lunch', 'dinner', 'snack'] | None = None
    notes: str | None = None
    is_template: bool | None = None

class InstantiateMealRequest(BaseModel):
    scheduled_date: date
    meal_type: Literal['breakfast', 'lunch', 'dinner', 'snack'] | None = None
    name: str | None = None

class MealRecipeResponse(BaseModel):
    recipe_id: str
    title: str
    description: str | None = None
    cook_time_min: int | None = None
    servings: int | None = None
    tags: list[str] = Field(default_factory=list)
    image_url: str | None = None
    sort_order: int = 0

class MealResponse(BaseModel):
    id: str
    name: str
    scheduled_date: date | None = None
    meal_type: str | None = None
    notes: str | None = None
    is_template: bool = False
    template_id: str | None = None
    instance_count: int | None = None
    recipes: list[MealRecipeResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

class AddRecipesToMealRequest(BaseModel):
    recipe_ids: list[str] = Field(..., min_length=1)
