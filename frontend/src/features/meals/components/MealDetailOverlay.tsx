import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  Loader2,
  ChevronDown,
  Plus,
  AlertTriangle,
  Trash2,
  CalendarDays,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  useMeal,
  useUpdateMeal,
  useDeleteMeal,
  useAddRecipesToMeal,
  useRemoveRecipeFromMeal,
} from '@/features/meals/hooks/useMeals'
import {
  MEAL_TYPE_CONFIG,
  EASE_OUT_EXPO,
} from '@/features/meals/lib/mealConstants'
import type { MealType } from '@/features/meals/lib/mealConstants'
import { MealTypeSelector } from './MealTypeSelector'
import { RecipePicker } from './RecipePicker'

interface MealDetailOverlayProps {
  mealId: number | null
  open: boolean
  onClose: () => void
}

export function MealDetailOverlay({ mealId, open, onClose }: MealDetailOverlayProps) {
  const { t } = useTranslation()
  const { data: meal, isLoading } = useMeal(mealId != null && mealId > 0 ? mealId : 0)
  const updateMeal = useUpdateMeal()
  const deleteMeal = useDeleteMeal()
  const addRecipes = useAddRecipesToMeal()
  const removeRecipe = useRemoveRecipeFromMeal()

  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [notesValue, setNotesValue] = useState('')
  const [showRecipePicker, setShowRecipePicker] = useState(false)
  const [pickerSelectedIds, setPickerSelectedIds] = useState<number[]>([])
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Sync local state when meal data changes
  const [lastMealId, setLastMealId] = useState<number | null>(null)
  if (meal && lastMealId !== meal.id) {
    setLastMealId(meal.id)
    setNameValue(meal.name)
    setNotesValue(meal.notes ?? '')
    setEditingName(false)
    setShowRecipePicker(false)
    setPickerSelectedIds([])
    setShowDeleteConfirm(false)
  }

  // Reset state when overlay closes
  useEffect(() => {
    if (!open) {
      setEditingName(false)
      setShowRecipePicker(false)
      setPickerSelectedIds([])
      setShowDeleteConfirm(false)
    }
  }, [open])

  const handleNameBlur = () => {
    setEditingName(false)
    if (meal && nameValue.trim() && nameValue.trim() !== meal.name) {
      updateMeal.mutate({ id: meal.id, data: { name: nameValue.trim() } })
    }
  }

  const handleDateChange = (date: string) => {
    if (meal) {
      updateMeal.mutate({ id: meal.id, data: { scheduled_date: date || undefined } })
    }
  }

  const handleMealTypeChange = (mt: string | null) => {
    if (meal) {
      updateMeal.mutate({
        id: meal.id,
        data: { meal_type: (mt as 'breakfast' | 'lunch' | 'dinner' | 'snack') ?? undefined },
      })
    }
  }

  const handleNotesBlur = () => {
    if (meal && notesValue !== (meal.notes ?? '')) {
      updateMeal.mutate({ id: meal.id, data: { notes: notesValue || undefined } })
    }
  }

  const handleRemoveRecipe = (recipeId: number) => {
    if (meal) {
      removeRecipe.mutate({ mealId: meal.id, recipeId })
    }
  }

  const togglePickerRecipe = useCallback((id: number) => {
    setPickerSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const handleAddSelected = async () => {
    if (!meal || pickerSelectedIds.length === 0) return
    try {
      await addRecipes.mutateAsync({
        mealId: meal.id,
        data: { recipe_ids: pickerSelectedIds },
      })
      setPickerSelectedIds([])
      setShowRecipePicker(false)
    } catch {
      // errors handled by hook toast
    }
  }

  const confirmDelete = () => {
    if (!meal) return
    deleteMeal.mutate(meal.id, {
      onSuccess: () => onClose(),
    })
  }

  // Resolve hero gradient from meal type
  const mealType = meal?.meal_type as MealType | null | undefined
  const config = mealType ? MEAL_TYPE_CONFIG[mealType] : null
  const heroGradient = config ? config.heroGradient : 'from-stone-100 via-stone-50 to-stone-100'
  const HeroIcon = config ? config.icon : CalendarDays

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Detail card */}
          <motion.div
            className="fixed inset-x-3 bottom-3 top-10 z-50 rounded-3xl border-2 border-stone-200/60 shadow-2xl overflow-hidden flex flex-col bg-[#FFFEF9] lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2 lg:w-[720px] lg:top-12 lg:bottom-auto lg:max-h-[88vh]"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/25 text-white hover:bg-black/50 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            {isLoading || !meal ? (
              <div className="flex justify-center items-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
              </div>
            ) : (
              <>
                {/* Hero section */}
                <div className={cn('relative h-28 shrink-0 bg-gradient-to-br', heroGradient)}>
                  <div className="absolute inset-0 flex items-center px-5 gap-4">
                    {/* Icon circle */}
                    <div className="w-12 h-12 rounded-full bg-white/40 backdrop-blur-sm flex items-center justify-center shrink-0">
                      <HeroIcon className="w-6 h-6 text-white drop-shadow" />
                    </div>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      {editingName ? (
                        <input
                          autoFocus
                          value={nameValue}
                          onChange={(e) => setNameValue(e.target.value)}
                          onBlur={handleNameBlur}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleNameBlur()
                          }}
                          className="w-full bg-white/60 backdrop-blur-sm rounded-lg px-3 py-1.5 text-lg font-bold text-[#1C1612] outline-none focus:ring-2 focus:ring-white/50"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingName(true)}
                          className="text-left w-full"
                        >
                          <h2 className="text-xl font-bold text-[#1C1612] truncate leading-tight">
                            {meal.name}
                          </h2>
                        </button>
                      )}

                      <div className="flex items-center gap-2 mt-1">
                        {meal.scheduled_date && (
                          <span className="text-xs text-stone-600/80 font-medium">
                            {meal.scheduled_date}
                          </span>
                        )}
                        {meal.meal_type && (
                          <span className={cn(
                            'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full',
                            config?.bgLight ?? 'bg-stone-100',
                            config?.textColor ?? 'text-stone-600',
                          )}>
                            {t(`meals.${meal.meal_type}`, meal.meal_type)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
                  {/* Date picker */}
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400 mb-2">
                      {t('meals.scheduledDate', 'Date')}
                    </p>
                    <input
                      type="date"
                      value={meal.scheduled_date ?? ''}
                      onChange={(e) => handleDateChange(e.target.value)}
                      className="w-full rounded-xl border border-stone-200/80 bg-white px-3 py-2 text-sm text-stone-700 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-colors"
                    />
                  </div>

                  {/* Meal type selector */}
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400 mb-2">
                      {t('meals.mealType', 'Meal type')}
                    </p>
                    <MealTypeSelector
                      value={meal.meal_type}
                      onChange={handleMealTypeChange}
                    />
                  </div>

                  {/* Notes */}
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400 mb-2">
                      {t('meals.notes', 'Notes')}
                    </p>
                    <textarea
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      onBlur={handleNotesBlur}
                      placeholder={t('meals.notesPlaceholder', 'Optional notes...')}
                      rows={2}
                      className="w-full rounded-xl border border-stone-200/80 bg-white px-3 py-2.5 text-sm text-stone-700 placeholder:text-stone-400 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-none transition-colors"
                    />
                  </div>

                  {/* Recipes in meal */}
                  <div>
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400 mb-2">
                      {t('meals.addRecipes', 'Recipes')}
                    </p>

                    {meal.recipes.length === 0 ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-stone-500">
                          {t('meals.noRecipesInMeal', 'No recipes in this meal yet')}
                        </p>
                        <p className="text-xs text-stone-400 mt-1">
                          {t('meals.addRecipesHint', 'Add saved recipes to build your meal')}
                        </p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        <AnimatePresence mode="popLayout">
                          {meal.recipes.map((r) => (
                            <motion.div
                              key={r.recipe_id}
                              layout
                              initial={{ opacity: 0, scale: 0.95 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0 }}
                              transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                              className="flex items-center gap-3 rounded-xl border border-stone-200/80 bg-white p-2.5"
                            >
                              {/* Thumbnail */}
                              {r.image_url ? (
                                <img
                                  src={r.image_url}
                                  alt={r.title}
                                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-stone-200 to-stone-300 shrink-0" />
                              )}

                              {/* Title */}
                              <span className="flex-1 text-sm font-medium text-stone-700 truncate">
                                {r.title}
                              </span>

                              {/* Remove button */}
                              <button
                                type="button"
                                onClick={() => handleRemoveRecipe(r.recipe_id)}
                                className="shrink-0 p-1.5 rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                                title={t('meals.removeRecipe', 'Remove from meal')}
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Add recipe toggle */}
                    <button
                      type="button"
                      onClick={() => setShowRecipePicker(!showRecipePicker)}
                      className="mt-3 flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {t('meals.addRecipes', 'Add recipes')}
                      <ChevronDown
                        className={cn(
                          'h-3 w-3 transition-transform',
                          showRecipePicker && 'rotate-180',
                        )}
                      />
                    </button>

                    <AnimatePresence>
                      {showRecipePicker && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 flex flex-col gap-2">
                            <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400">
                              {t('meals.recipePickerTitle', 'Select recipes')}
                            </p>
                            <RecipePicker
                              selectedIds={pickerSelectedIds}
                              onToggle={togglePickerRecipe}
                            />
                            {pickerSelectedIds.length > 0 && (
                              <button
                                type="button"
                                onClick={handleAddSelected}
                                disabled={addRecipes.isPending}
                                className="mt-1 w-full py-2 bg-[#1C1612] text-white rounded-xl font-semibold text-sm hover:bg-stone-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                              >
                                {addRecipes.isPending ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  t('meals.addSelected', 'Add selected')
                                )}
                              </button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Footer — delete action */}
                <div className="shrink-0 border-t border-stone-200/60 bg-[#FFFEF9]">
                  {!showDeleteConfirm && (
                    <div className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        disabled={deleteMeal.isPending}
                        className="w-full py-2.5 bg-red-50 text-red-600 rounded-2xl font-semibold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('meals.deleteMeal', 'Delete meal')}
                      </button>
                    </div>
                  )}

                  {/* Inline delete confirmation */}
                  <AnimatePresence>
                    {showDeleteConfirm && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-red-50/80 border-t border-red-200/60 px-5 py-4 flex items-center gap-3">
                          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                          <p className="flex-1 text-sm text-red-700">
                            {t('meals.deleteConfirm', 'Delete this meal?')}
                          </p>
                          <button
                            type="button"
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-stone-200 text-stone-600 hover:bg-stone-50 transition-colors"
                            onClick={() => setShowDeleteConfirm(false)}
                          >
                            {t('common.cancel', 'Cancel')}
                          </button>
                          <button
                            type="button"
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50"
                            onClick={confirmDelete}
                            disabled={deleteMeal.isPending}
                          >
                            {deleteMeal.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              t('meals.deleteMeal', 'Delete')
                            )}
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
