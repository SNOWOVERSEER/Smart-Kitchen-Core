import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import i18next from 'i18next'
import {
  getMeals, getMeal, createMeal, updateMeal, deleteMeal,
  addRecipesToMeal, removeRecipeFromMeal,
} from '@/features/meals/api'
import type { MealCreate, MealUpdate, AddRecipesToMealRequest } from '@/shared/lib/api.types'

const MEALS_KEY = ['meals'] as const

export function useMeals() {
  return useQuery({ queryKey: MEALS_KEY, queryFn: () => getMeals() })
}

export function useMeal(id: number) {
  return useQuery({ queryKey: [...MEALS_KEY, id], queryFn: () => getMeal(id), enabled: id > 0 })
}

export function useCreateMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: MealCreate) => createMeal(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MEALS_KEY })
      toast.success(i18next.t('meals.created'))
    },
    onError: () => toast.error(i18next.t('meals.createFailed', 'Failed to create meal')),
  })
}

export function useUpdateMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: MealUpdate }) => updateMeal(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MEALS_KEY })
      toast.success(i18next.t('meals.updated'))
    },
    onError: () => toast.error(i18next.t('meals.updateFailed', 'Failed to update meal')),
  })
}

export function useDeleteMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteMeal(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MEALS_KEY })
      toast.success(i18next.t('meals.deleted'))
    },
    onError: () => toast.error(i18next.t('meals.deleteFailed', 'Failed to delete meal')),
  })
}

export function useAddRecipesToMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ mealId, data }: { mealId: number; data: AddRecipesToMealRequest }) =>
      addRecipesToMeal(mealId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MEALS_KEY })
      toast.success(i18next.t('meals.added'))
    },
    onError: () => toast.error(i18next.t('meals.addFailed', 'Failed to add recipes')),
  })
}

export function useRemoveRecipeFromMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ mealId, recipeId }: { mealId: number; recipeId: number }) =>
      removeRecipeFromMeal(mealId, recipeId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MEALS_KEY })
      toast.success(i18next.t('meals.removed'))
    },
    onError: () => toast.error(i18next.t('meals.removeFailed', 'Failed to remove recipe')),
  })
}
