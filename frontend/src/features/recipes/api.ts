import { apiClient } from '@/shared/lib/axios'
import type {
  GenerateRecipesRequest,
  GenerateRecipesResponse,
  SaveRecipeRequest,
  SavedRecipe,
} from '@/shared/lib/api.types'

const DEFAULT_SAVED_RECIPES_LIMIT = 100

export async function generateRecipes(req: GenerateRecipesRequest): Promise<GenerateRecipesResponse> {
  const response = await apiClient.post<GenerateRecipesResponse>('/api/v1/recipes/generate', req)
  return response.data
}

export async function saveRecipe(req: SaveRecipeRequest): Promise<SavedRecipe> {
  const response = await apiClient.post<SavedRecipe>('/api/v1/recipes', req)
  return response.data
}

export async function getSavedRecipes(limit = DEFAULT_SAVED_RECIPES_LIMIT, offset = 0): Promise<SavedRecipe[]> {
  const response = await apiClient.get<SavedRecipe[]>('/api/v1/recipes', {
    params: { limit, offset },
  })
  return response.data
}

export async function getSavedRecipe(id: string): Promise<SavedRecipe> {
  const response = await apiClient.get<SavedRecipe>(`/api/v1/recipes/${id}`)
  return response.data
}

export async function deleteRecipe(id: string): Promise<void> {
  await apiClient.delete(`/api/v1/recipes/${id}`)
}
