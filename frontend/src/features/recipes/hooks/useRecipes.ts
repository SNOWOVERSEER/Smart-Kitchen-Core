import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import i18next from 'i18next'
import { generateRecipes, saveRecipe, getSavedRecipes, deleteRecipe, generateRecipeImage } from '@/features/recipes/api'
import type { GenerateRecipesRequest, SaveRecipeRequest } from '@/shared/lib/api.types'

const RECIPES_KEY = ['recipes'] as const

export function useSavedRecipes() {
  return useQuery({ queryKey: RECIPES_KEY, queryFn: getSavedRecipes })
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
      toast.success(i18next.t('recipes.saved'))
    },
    onError: () => toast.error(i18next.t('recipes.saveFailed')),
  })
}

export function useDeleteRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteRecipe(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: RECIPES_KEY }),
    onError: () => toast.error(i18next.t('recipes.deleteFailed')),
  })
}

export function useGenerateRecipeImage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => generateRecipeImage(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: RECIPES_KEY }),
    onError: () => console.warn('Image generation failed'), // silent — non-critical
  })
}
