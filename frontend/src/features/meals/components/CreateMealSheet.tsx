import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { useCreateMeal } from '@/features/meals/hooks/useMeals'
import { EASE_OUT_EXPO } from '@/features/meals/lib/mealConstants'
import { MealTypeSelector } from './MealTypeSelector'
import { RecipePicker } from './RecipePicker'

const sectionVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: EASE_OUT_EXPO },
  }),
}

interface CreateMealSheetProps {
  open: boolean
  onClose: () => void
}

export function CreateMealSheet({ open, onClose }: CreateMealSheetProps) {
  const { t } = useTranslation()
  const createMeal = useCreateMeal()

  const [name, setName] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [mealType, setMealType] = useState<string | null>(null)
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<number[]>([])

  const resetForm = useCallback(() => {
    setName('')
    setScheduledDate('')
    setMealType(null)
    setSelectedRecipeIds([])
  }, [])

  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!v) {
        resetForm()
        onClose()
      }
    },
    [resetForm, onClose],
  )

  const toggleRecipe = useCallback((id: number) => {
    setSelectedRecipeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }, [])

  const canSubmit = name.trim().length > 0 && !createMeal.isPending

  const handleSubmit = async () => {
    if (!canSubmit) return
    try {
      await createMeal.mutateAsync({
        name: name.trim(),
        scheduled_date: scheduledDate || undefined,
        meal_type:
          (mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack') ?? undefined,
        recipe_ids:
          selectedRecipeIds.length > 0 ? selectedRecipeIds : undefined,
      })
      resetForm()
      onClose()
    } catch {
      // errors handled by hook toast
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl pb-safe max-h-[88vh] overflow-y-auto"
      >
        <SheetHeader className="mb-5">
          <SheetTitle className="text-lg font-semibold text-[#1C1612]">
            {t('meals.createMeal', 'Create meal')}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t('meals.createMeal', 'Create meal')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5">
          {/* Name */}
          <motion.div
            custom={0}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <label className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400 mb-2 block">
              {t('meals.name', 'Meal name')}
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('meals.namePlaceholder', 'e.g. Weekend BBQ')}
              className="w-full bg-white rounded-xl border border-stone-200/80 px-4 py-3 text-sm text-[#1C1612] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            />
          </motion.div>

          {/* Date */}
          <motion.div
            custom={1}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <label className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400 mb-2 block">
              {t('meals.scheduledDate', 'Date')}
            </label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full bg-white rounded-xl border border-stone-200/80 px-4 py-3 text-sm text-[#1C1612] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
            />
          </motion.div>

          {/* Meal type */}
          <motion.div
            custom={2}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <label className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400 mb-2 block">
              {t('meals.mealType', 'Meal type')}
            </label>
            <MealTypeSelector value={mealType} onChange={setMealType} />
          </motion.div>

          {/* Recipe picker */}
          <motion.div
            custom={3}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
          >
            <label className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400 mb-2 block">
              {t('meals.addRecipes', 'Add recipes')}
            </label>
            <RecipePicker
              selectedIds={selectedRecipeIds}
              onToggle={toggleRecipe}
            />
          </motion.div>

          {/* Actions */}
          <motion.div
            custom={4}
            variants={sectionVariants}
            initial="hidden"
            animate="visible"
            className="flex gap-3 pt-2"
          >
            <button
              type="button"
              onClick={onClose}
              disabled={createMeal.isPending}
              className="flex-1 bg-stone-100 text-stone-600 rounded-xl h-12 font-semibold text-sm transition-colors hover:bg-stone-200 disabled:opacity-50"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 bg-[#1C1612] text-white rounded-xl h-12 font-semibold text-sm transition-colors hover:bg-[#2a221c] disabled:opacity-50 flex items-center justify-center"
            >
              {createMeal.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('common.create', 'Create')
              )}
            </button>
          </motion.div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
