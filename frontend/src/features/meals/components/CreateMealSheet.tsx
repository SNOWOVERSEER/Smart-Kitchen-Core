import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Loader2, AlertTriangle } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { DateInput } from '@/components/ui/date-input'
import { useCreateMeal, useDeleteMeal } from '@/features/meals/hooks/useMeals'
import { EASE_OUT_EXPO } from '@/features/meals/lib/mealConstants'
import type { MealResponse } from '@/shared/lib/api.types'
import { MealTypeSelector } from './MealTypeSelector'
import { RecipePicker } from './RecipePicker'
import {
  MEAL_FORM_INPUT,
  MEAL_FORM_LABEL,
  MEAL_FORM_PRIMARY_BUTTON,
  MEAL_FORM_SECONDARY_BUTTON,
  MEAL_FORM_SECTION,
} from './mealFormStyles'

const UNIQUE_MEAL_TYPES = new Set(['breakfast', 'lunch', 'dinner'])

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
  meals: MealResponse[]
}

export function CreateMealSheet({ open, onClose, meals }: CreateMealSheetProps) {
  const { t } = useTranslation()
  const createMeal = useCreateMeal()
  const deleteMeal = useDeleteMeal()

  const [name, setName] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [mealType, setMealType] = useState<string | null>(null)
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<number[]>([])
  const [isTemplate, setIsTemplate] = useState(false)
  const [conflictMeal, setConflictMeal] = useState<MealResponse | null>(null)

  const resetForm = useCallback(() => {
    setName('')
    setScheduledDate('')
    setMealType(null)
    setSelectedRecipeIds([])
    setIsTemplate(false)
    setConflictMeal(null)
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

  const buildMealData = () => ({
    name: name.trim(),
    scheduled_date: isTemplate ? undefined : (scheduledDate || undefined),
    meal_type:
      (mealType as 'breakfast' | 'lunch' | 'dinner' | 'snack') ?? undefined,
    recipe_ids:
      selectedRecipeIds.length > 0 ? selectedRecipeIds : undefined,
    is_template: isTemplate || undefined,
  })

  const doCreate = async () => {
    try {
      await createMeal.mutateAsync(buildMealData())
      resetForm()
      onClose()
    } catch {
      // errors handled by hook toast
    }
  }

  const handleSubmit = async () => {
    if (!canSubmit) return

    // Check for meal-type conflict (only for scheduled instances, not templates)
    if (!isTemplate && scheduledDate && mealType && UNIQUE_MEAL_TYPES.has(mealType)) {
      const existing = meals.find(
        (m) => m.scheduled_date === scheduledDate && m.meal_type === mealType,
      )
      if (existing) {
        setConflictMeal(existing)
        return
      }
    }

    await doCreate()
  }

  const handleConfirmReplace = async () => {
    if (!conflictMeal) return
    deleteMeal.mutate(conflictMeal.id)
    setConflictMeal(null)
    await doCreate()
  }

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl max-h-[92dvh] flex flex-col p-0 bg-[#FFFEF9] overflow-hidden gap-0"
        >
          <div className="flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-9 h-1 rounded-full bg-stone-200" />
          </div>

          <SheetHeader className="px-5 pt-1 pb-4 border-b border-stone-100 shrink-0">
            <SheetTitle
              className="text-[1.4rem] text-[#1C1612] leading-tight font-normal"
              style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
            >
              {t('meals.createMeal', 'Create meal')}
            </SheetTitle>
            <SheetDescription className="sr-only">
              {t('meals.createMeal', 'Create meal')}
            </SheetDescription>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-4 pb-0">
            <div className="flex flex-col gap-4">
              {/* Name */}
              <motion.div
                custom={0}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
                className={MEAL_FORM_SECTION}
              >
                <label className={MEAL_FORM_LABEL}>
                  {t('meals.name', 'Meal name')}
                </label>
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('meals.namePlaceholder', 'e.g. Weekend BBQ')}
                  className={MEAL_FORM_INPUT}
                />
              </motion.div>

              {/* Save as template toggle */}
              <motion.div
                custom={1}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
                className={MEAL_FORM_SECTION}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <label className={MEAL_FORM_LABEL}>
                      {t('meals.saveAsTemplate', 'Save as template')}
                    </label>
                    <p className="text-[10.5px] text-stone-400 mt-0.5">
                      {t('meals.templateHint', 'Templates are reusable meal blueprints')}
                    </p>
                  </div>
                  <Switch
                    checked={isTemplate}
                    onCheckedChange={setIsTemplate}
                  />
                </div>
              </motion.div>

              {/* Date (hidden when saving as template) */}
              {!isTemplate && (
                <motion.div
                  custom={2}
                  variants={sectionVariants}
                  initial="hidden"
                  animate="visible"
                  className={MEAL_FORM_SECTION}
                >
                  <label className={MEAL_FORM_LABEL}>
                    {t('meals.scheduledDate', 'Date')}
                  </label>
                  <DateInput
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className={MEAL_FORM_INPUT}
                  />
                </motion.div>
              )}

              {/* Meal type */}
              <motion.div
                custom={isTemplate ? 2 : 3}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
                className={MEAL_FORM_SECTION}
              >
                <label className={MEAL_FORM_LABEL}>
                  {t('meals.mealType', 'Meal type')}
                </label>
                <MealTypeSelector value={mealType} onChange={setMealType} />
              </motion.div>

              {/* Recipe picker */}
              <motion.div
                custom={isTemplate ? 3 : 4}
                variants={sectionVariants}
                initial="hidden"
                animate="visible"
                className={MEAL_FORM_SECTION}
              >
                <label className={MEAL_FORM_LABEL}>
                  {t('meals.addRecipes', 'Add recipes')}
                  {selectedRecipeIds.length > 0 && (
                    <span className="ml-1 text-primary/80 normal-case tracking-normal font-semibold">
                      ({selectedRecipeIds.length})
                    </span>
                  )}
                </label>
                <RecipePicker
                  selectedIds={selectedRecipeIds}
                  onToggle={toggleRecipe}
                />
              </motion.div>
            </div>
          </div>

          <div
            className="px-5 pt-3 pb-4 border-t border-stone-100 bg-white shrink-0 flex gap-2.5"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={createMeal.isPending}
              className={MEAL_FORM_SECONDARY_BUTTON}
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={MEAL_FORM_PRIMARY_BUTTON}
            >
              {createMeal.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t('common.create', 'Create')
              )}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Replace meal confirmation dialog */}
      <Dialog open={conflictMeal !== null} onOpenChange={(v) => { if (!v) setConflictMeal(null) }}>
        <DialogContent showCloseButton={false} className="max-w-sm rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
              </div>
              <DialogTitle className="text-base">
                {t('meals.replaceConfirmTitle', 'Replace existing meal?')}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-stone-500 mt-2">
              {conflictMeal && t('meals.replaceConfirmDesc', {
                date: scheduledDate ? format(parseISO(scheduledDate), 'MMM d') : '',
                mealType: mealType ? t(`meals.${mealType}`, mealType) : '',
                existingName: conflictMeal.name,
                newName: name.trim(),
                defaultValue: '{{date}} already has a {{mealType}}. Replace "{{existingName}}" with "{{newName}}"?',
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConflictMeal(null)}
            >
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleConfirmReplace}
            >
              {t('meals.replace', 'Replace')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
