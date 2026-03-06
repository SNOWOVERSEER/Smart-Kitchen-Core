import { apiClient } from '@/shared/lib/axios'
import type {
  MealResponse,
  MealCreate,
  MealUpdate,
  AddRecipesToMealRequest,
  InstantiateMealRequest,
} from '@/shared/lib/api.types'

export async function getMeals(dateFrom?: string, dateTo?: string): Promise<MealResponse[]> {
  const params = new URLSearchParams()
  if (dateFrom) params.set('date_from', dateFrom)
  if (dateTo) params.set('date_to', dateTo)
  const response = await apiClient.get<MealResponse[]>(`/api/v1/meals?${params}`)
  return response.data
}

export async function getMealTemplates(): Promise<MealResponse[]> {
  const response = await apiClient.get<MealResponse[]>('/api/v1/meals?is_template=true')
  return response.data
}

export async function instantiateMeal(templateId: string, data: InstantiateMealRequest): Promise<MealResponse> {
  const response = await apiClient.post<MealResponse>(`/api/v1/meals/${templateId}/instantiate`, data)
  return response.data
}

export async function getMeal(id: string): Promise<MealResponse> {
  const response = await apiClient.get<MealResponse>(`/api/v1/meals/${id}`)
  return response.data
}

export async function createMeal(data: MealCreate): Promise<MealResponse> {
  const response = await apiClient.post<MealResponse>('/api/v1/meals', data)
  return response.data
}

export async function updateMeal(id: string, data: MealUpdate): Promise<MealResponse> {
  const response = await apiClient.patch<MealResponse>(`/api/v1/meals/${id}`, data)
  return response.data
}

export async function deleteMeal(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/meals/${id}`)
}

export async function addRecipesToMeal(mealId: string, data: AddRecipesToMealRequest): Promise<MealResponse> {
  const response = await apiClient.post<MealResponse>(`/api/v1/meals/${mealId}/recipes`, data)
  return response.data
}

export async function removeRecipeFromMeal(mealId: string, recipeId: string): Promise<MealResponse> {
  const response = await apiClient.delete<MealResponse>(`/api/v1/meals/${mealId}/recipes/${recipeId}`)
  return response.data
}
