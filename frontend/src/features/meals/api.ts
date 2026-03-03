import { apiClient } from '@/shared/lib/axios'
import type {
  MealResponse,
  MealCreate,
  MealUpdate,
  AddRecipesToMealRequest,
} from '@/shared/lib/api.types'

export async function getMeals(dateFrom?: string, dateTo?: string): Promise<MealResponse[]> {
  const params = new URLSearchParams()
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  const response = await apiClient.get<MealResponse[]>(`/api/v1/meals?${params}`)
  return response.data
}

export async function getMeal(id: number): Promise<MealResponse> {
  const response = await apiClient.get<MealResponse>(`/api/v1/meals/${id}`)
  return response.data
}

export async function createMeal(data: MealCreate): Promise<MealResponse> {
  const response = await apiClient.post<MealResponse>('/api/v1/meals', data)
  return response.data
}

export async function updateMeal(id: number, data: MealUpdate): Promise<MealResponse> {
  const response = await apiClient.patch<MealResponse>(`/api/v1/meals/${id}`, data)
  return response.data
}

export async function deleteMeal(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/meals/${id}`)
}

export async function addRecipesToMeal(mealId: number, data: AddRecipesToMealRequest): Promise<MealResponse> {
  const response = await apiClient.post<MealResponse>(`/api/v1/meals/${mealId}/recipes`, data)
  return response.data
}

export async function removeRecipeFromMeal(mealId: number, recipeId: number): Promise<MealResponse> {
  const response = await apiClient.delete<MealResponse>(`/api/v1/meals/${mealId}/recipes/${recipeId}`)
  return response.data
}
