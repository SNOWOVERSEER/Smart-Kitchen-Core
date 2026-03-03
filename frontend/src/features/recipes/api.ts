import { apiClient } from '@/shared/lib/axios'
import type {
  GenerateRecipesRequest,
  GenerateRecipesResponse,
  SaveRecipeRequest,
  SavedRecipe,
} from '@/shared/lib/api.types'

export async function generateRecipes(req: GenerateRecipesRequest): Promise<GenerateRecipesResponse> {
  const response = await apiClient.post<GenerateRecipesResponse>('/api/v1/recipes/generate', req)
  return response.data
}

export async function saveRecipe(req: SaveRecipeRequest): Promise<SavedRecipe> {
  const response = await apiClient.post<SavedRecipe>('/api/v1/recipes', req)
  return response.data
}

export async function getSavedRecipes(): Promise<SavedRecipe[]> {
  const response = await apiClient.get<SavedRecipe[]>('/api/v1/recipes')
  return response.data
}

export async function getSavedRecipe(id: number): Promise<SavedRecipe> {
  const response = await apiClient.get<SavedRecipe>(`/api/v1/recipes/${id}`)
  return response.data
}

export async function deleteRecipe(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/recipes/${id}`)
}
