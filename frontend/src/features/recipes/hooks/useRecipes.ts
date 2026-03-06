import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import i18next from 'i18next'
import { generateRecipes, saveRecipe, getSavedRecipes, getSavedRecipe, deleteRecipe } from '@/features/recipes/api'
import type { GenerateRecipesRequest, SaveRecipeRequest } from '@/shared/lib/api.types'

const RECIPES_KEY = ['recipes'] as const

export function useSavedRecipes() {
  return useQuery({ queryKey: RECIPES_KEY, queryFn: getSavedRecipes })
}

export function useRecipe(id: string) {
  return useQuery({
    queryKey: [...RECIPES_KEY, id],
    queryFn: () => getSavedRecipe(id),
    enabled: !!id,
  })
}

export function useGenerateRecipes() {
  return useMutation({
    mutationFn: (req: GenerateRecipesRequest) => generateRecipes(req),
    // No invalidation — results are ephemeral (not saved until swiped right)
  })
}

export function useSaveRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (req: SaveRecipeRequest) => saveRecipe(req),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: RECIPES_KEY })
      toast.success(i18next.t('recipes.saved'), { id: 'recipe-action' })
    },
    onError: () => toast.error(i18next.t('recipes.saveFailed'), { id: 'recipe-action' }),
  })
}

export function useDeleteRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteRecipe(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: RECIPES_KEY }),
    onError: () => toast.error(i18next.t('recipes.deleteFailed'), { id: 'recipe-action' }),
  })
}
