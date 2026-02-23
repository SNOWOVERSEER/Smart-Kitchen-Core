import { apiClient } from '@/shared/lib/axios'
import type {
  ShoppingItem,
  ShoppingItemCreate,
  ShoppingItemUpdate,
  CompleteShoppingRequest,
  CompleteShoppingResult,
} from '@/shared/lib/api.types'

export async function getShoppingList(): Promise<ShoppingItem[]> {
  const response = await apiClient.get<ShoppingItem[]>('/api/v1/shopping')
  return response.data
}

export async function addShoppingItem(item: ShoppingItemCreate): Promise<ShoppingItem> {
  const response = await apiClient.post<ShoppingItem>('/api/v1/shopping', item)
  return response.data
}

export async function addShoppingItemsBulk(items: ShoppingItemCreate[]): Promise<ShoppingItem[]> {
  const response = await apiClient.post<ShoppingItem[]>('/api/v1/shopping/bulk', items)
  return response.data
}

export async function updateShoppingItem(id: number, update: ShoppingItemUpdate): Promise<ShoppingItem> {
  const response = await apiClient.patch<ShoppingItem>(`/api/v1/shopping/${id}`, update)
  return response.data
}

export async function deleteShoppingItem(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/shopping/${id}`)
}

export async function deleteCheckedItems(): Promise<{ deleted_count: number }> {
  const response = await apiClient.delete<{ deleted_count: number }>('/api/v1/shopping/checked')
  return response.data
}

export async function completeShopping(req: CompleteShoppingRequest): Promise<CompleteShoppingResult> {
  const response = await apiClient.post<CompleteShoppingResult>('/api/v1/shopping/complete', req)
  return response.data
}
