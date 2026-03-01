// Auth
export interface AuthResponse {
  access_token: string
  refresh_token: string
  user_id: string
  email: string
}

export interface SignupResponse {
  requires_email_verification: boolean
  message: string
  access_token: string | null
  refresh_token: string | null
  user_id: string | null
  email: string
}

export interface ProfileResponse {
  id: string
  email: string | null
  display_name: string | null
  preferred_language: string
}

export interface ProfileUpdateRequest {
  display_name?: string
  preferred_language?: string
}

// Inventory
export interface InventoryItemResponse {
  id: number
  item_name: string
  brand: string | null
  quantity: number
  total_volume: number
  unit: string
  category: string | null
  expiry_date: string | null
  is_open: boolean
  location: string
  created_at: string | null
}

export interface InventoryGroupResponse {
  item_name: string
  total_quantity: number
  unit: string
  batches: InventoryItemResponse[]
}

export interface AddInventoryRequest {
  item_name: string
  brand?: string
  quantity: number
  total_volume: number
  unit: string
  category?: string
  expiry_date?: string
  is_open?: boolean
  location: string
}

export interface UpdateInventoryRequest {
  quantity?: number
  total_volume?: number
  unit?: string
  brand?: string
  category?: string
  expiry_date?: string
  is_open?: boolean
  location?: string
}

export interface ConsumeRequest {
  item_name: string
  amount: number
  unit?: string
  brand?: string
}

export interface AffectedBatch {
  id: number
  item_name: string
  brand: string | null
  consumed: number
  remaining: number
}

export interface ConsumeResult {
  success: boolean
  consumed_amount: number
  remaining_to_consume: number
  affected_batches: AffectedBatch[]
  message: string
}

// Agent
export type AgentStatus = 'completed' | 'awaiting_info' | 'awaiting_confirm'

export interface PendingActionItem {
  intent: 'ADD' | 'CONSUME' | 'DISCARD' | 'QUERY'
  extracted_info: Record<string, unknown>
  missing_fields: string[]
}

export interface PendingActionResponse {
  items: PendingActionItem[] | null
  confirmation_message: string | null
}

export interface AgentActionRequest {
  text: string
  thread_id?: string | null
  confirm?: boolean
}

export interface AgentActionResponse {
  response: string
  thread_id: string
  status: AgentStatus
  pending_action: PendingActionResponse | null
  tool_calls: Record<string, unknown>[]
}

// Logs
export type TransactionIntent = 'INBOUND' | 'CONSUME' | 'DISCARD' | 'UPDATE'

export interface TransactionLogResponse {
  id: number
  intent: TransactionIntent
  raw_input: string | null
  ai_reasoning: string | null
  operation_details: Record<string, unknown> | null
  created_at: string | null
}

// Barcode
export interface BarcodeProduct {
  item_name: string
  brand: string | null
  category: string | null
  unit: string
  default_quantity: number
  image_url: string | null
}

export interface BarcodeResponse {
  found: boolean
  barcode: string
  product: BarcodeProduct | null
}

// Photo Recognition
export interface RecognizedItem {
  item_name: string
  brand: string | null
  quantity: number
  unit: string
  confidence: 'high' | 'medium' | 'low'
}

export interface PhotoRecognizeRequest {
  image_base64: string
  thread_id?: string | null
}

export interface PhotoRecognizeResponse {
  recognized_items: RecognizedItem[]
  description: string
  agent_response: AgentActionResponse
}

// AI Config
export interface AIConfigResponse {
  id: string
  provider: string
  model_id: string
  is_active: boolean
  api_key_preview: string
  created_at: string | null
}

export interface AddAIConfigRequest {
  provider: string
  api_key: string
  model_id: string
}

// Recipes
export interface RecipeIngredient {
  name: string
  quantity: number | null
  unit: string | null
  have_in_stock: boolean
  batch_ids: number[]
  /** Available / required ratio. Only set when have_in_stock=false and qty was comparable. */
  coverage_ratio: number | null
}

export interface RecipeCard {
  title: string
  description: string
  cook_time_min: number | null
  servings: number | null
  ingredients: RecipeIngredient[]
  instructions: string[]
  tags: string[]
  image_prompt: string | null
}

export interface GenerateRecipesRequest {
  categories: string[]
  use_expiring: boolean
  prompt?: string
}

export interface GenerateRecipesResponse {
  recipes: RecipeCard[]
}

export interface SaveRecipeRequest {
  recipe: RecipeCard
  source_mode: string
  source_prompt?: string
  image_prompt?: string
}

export interface SavedRecipe {
  id: number
  title: string
  description: string | null
  cook_time_min: number | null
  servings: number | null
  ingredients: RecipeIngredient[]
  instructions: string[]
  tags: string[]
  source_mode: string
  source_prompt: string | null
  image_url: string | null
  image_prompt: string | null
  created_at: string
}

// Shopping
export interface ShoppingItem {
  id: number
  item_name: string
  brand: string | null
  quantity: number | null
  unit: string | null
  category: string | null
  is_checked: boolean
  source: 'manual' | 'recipe' | 'agent'
  source_recipe_id: number | null
  source_recipe_title: string | null
  note: string | null
  created_at: string
  updated_at: string
}

export interface ShoppingItemCreate {
  item_name: string
  brand?: string
  quantity?: number
  unit?: string
  category?: string
  source?: 'manual' | 'recipe' | 'agent'
  source_recipe_id?: number
  source_recipe_title?: string
  note?: string
}

export interface ShoppingItemUpdate {
  item_name?: string
  brand?: string
  quantity?: number
  unit?: string
  category?: string
  is_checked?: boolean
  note?: string
  source_recipe_id?: number
  source_recipe_title?: string
}

export interface CompleteShoppingRequest {
  item_ids: number[]
  default_location?: string
}

export interface CompleteShoppingResult {
  added_count: number
  failed_items: string[]
  inventory_ids: number[]
}
