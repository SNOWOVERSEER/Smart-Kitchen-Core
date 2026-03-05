import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import i18next from 'i18next'
import {
  getMeals, getMeal, createMeal, updateMeal, deleteMeal,
  addRecipesToMeal, removeRecipeFromMeal,
  getMealTemplates, instantiateMeal,
} from '@/features/meals/api'
import type { MealCreate, MealUpdate, AddRecipesToMealRequest, InstantiateMealRequest } from '@/shared/lib/api.types'

const MEALS_KEY = ['meals'] as const
const TEMPLATES_KEY = ['meals', 'templates'] as const

export function useMeals() {
  return useQuery({ queryKey: MEALS_KEY, queryFn: () => getMeals() })
}

export function useMealTemplates() {
  return useQuery({ queryKey: TEMPLATES_KEY, queryFn: () => getMealTemplates() })
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
      toast.success(i18next.t('meals.created'), { id: 'meal-action' })
    },
    onError: () => toast.error(i18next.t('meals.createFailed', 'Failed to create meal'), { id: 'meal-action' }),
  })
}

export function useUpdateMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: MealUpdate }) => updateMeal(id, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MEALS_KEY })
      toast.success(i18next.t('meals.updated'), { id: 'meal-action' })
    },
    onError: () => toast.error(i18next.t('meals.updateFailed', 'Failed to update meal'), { id: 'meal-action' }),
  })
}

export function useDeleteMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => deleteMeal(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MEALS_KEY })
      toast.success(i18next.t('meals.deleted'), { id: 'meal-action' })
    },
    onError: () => toast.error(i18next.t('meals.deleteFailed', 'Failed to delete meal'), { id: 'meal-action' }),
  })
}

export function useAddRecipesToMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ mealId, data }: { mealId: number; data: AddRecipesToMealRequest }) =>
      addRecipesToMeal(mealId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MEALS_KEY })
      toast.success(i18next.t('meals.added'), { id: 'meal-recipe' })
    },
    onError: () => toast.error(i18next.t('meals.addFailed', 'Failed to add recipes'), { id: 'meal-recipe' }),
  })
}

export function useRemoveRecipeFromMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ mealId, recipeId }: { mealId: number; recipeId: number }) =>
      removeRecipeFromMeal(mealId, recipeId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MEALS_KEY })
      toast.success(i18next.t('meals.removed'), { id: 'meal-recipe' })
    },
    onError: () => toast.error(i18next.t('meals.removeFailed', 'Failed to remove recipe'), { id: 'meal-recipe' }),
  })
}

export function useInstantiateMeal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: number; data: InstantiateMealRequest }) =>
      instantiateMeal(templateId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: MEALS_KEY })
      toast.success(i18next.t('meals.instantiated', 'Meal added to calendar'), { id: 'meal-action' })
    },
    onError: () => toast.error(i18next.t('meals.instantiateFailed', 'Failed to add meal'), { id: 'meal-action' }),
  })
}
