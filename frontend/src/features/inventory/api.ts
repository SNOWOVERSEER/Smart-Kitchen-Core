import { apiClient } from '@/shared/lib/axios'
import type {
  InventoryGroupResponse,
  InventoryItemResponse,
  AddInventoryRequest,
  UpdateInventoryRequest,
  ConsumeRequest,
  ConsumeResult,
} from '@/shared/lib/api.types'

export async function getInventory(): Promise<InventoryGroupResponse[]> {
  const response = await apiClient.get<InventoryGroupResponse[]>('/api/v1/inventory')
  return response.data
}

export async function addInventoryItem(data: AddInventoryRequest): Promise<InventoryItemResponse> {
  const response = await apiClient.post<InventoryItemResponse>('/api/v1/inventory', data)
  return response.data
}

export async function updateBatch(batchId: number, data: UpdateInventoryRequest): Promise<InventoryItemResponse> {
  const response = await apiClient.patch<InventoryItemResponse>(`/api/v1/inventory/${batchId}`, data)
  return response.data
}

export async function deleteBatch(batchId: number): Promise<void> {
  await apiClient.delete(`/api/v1/inventory/${batchId}`)
}

export async function consumeItem(data: ConsumeRequest): Promise<ConsumeResult> {
  const response = await apiClient.post<ConsumeResult>('/api/v1/inventory/consume', data)
  return response.data
}
