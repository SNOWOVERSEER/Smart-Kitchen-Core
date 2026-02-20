// Auth
export interface AuthResponse {
  access_token: string
  refresh_token: string
  user_id: string
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
