import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus, Check } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { DateInput } from '@/components/ui/date-input'
import { useMeals, useCreateMeal, useAddRecipesToMeal } from '@/features/meals/hooks/useMeals'
import { cn } from '@/lib/utils'
import {
  MEAL_FORM_INPUT,
  MEAL_FORM_LABEL,
  MEAL_FORM_PRIMARY_BUTTON,
  MEAL_FORM_SECONDARY_BUTTON,
  MEAL_FORM_SECTION,
} from './mealFormStyles'
import { MealTypeSelector } from './MealTypeSelector'

interface AddToMealSheetProps {
  recipeIds: number[]
  open: boolean
  onClose: () => void
}

export function AddToMealSheet({ recipeIds, open, onClose }: AddToMealSheetProps) {
  const { t } = useTranslation()
  const { data: meals, isLoading } = useMeals()
  const createMeal = useCreateMeal()
  const addRecipes = useAddRecipesToMeal()

  const hasMeals = !!meals?.length
  const [mode, setMode] = useState<'existing' | 'new'>(hasMeals ? 'existing' : 'new')
  const [selectedMealId, setSelectedMealId] = useState<number | null>(null)
  const [newMealName, setNewMealName] = useState('')
  const [newIsTemplate, setNewIsTemplate] = useState(true)
  const [newScheduledDate, setNewScheduledDate] = useState('')
  const [newMealType, setNewMealType] = useState<string | null>(null)

  const isPending = createMeal.isPending || addRecipes.isPending

  // Reset state when sheet opens/closes
  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!v) {
        setMode(hasMeals ? 'existing' : 'new')
        setSelectedMealId(null)
        setNewMealName('')
        setNewIsTemplate(true)
        setNewScheduledDate('')
        setNewMealType(null)
        onClose()
      }
    },
    [hasMeals, onClose],
  )

  const newNeedsDate = mode === 'new' && !newIsTemplate && !newScheduledDate
  const canSubmit =
    !isPending &&
    recipeIds.length > 0 &&
    (mode === 'new'
      ? newMealName.trim().length > 0 && !newNeedsDate
      : selectedMealId !== null)

  const handleSubmit = async () => {
    if (!canSubmit) return

    try {
      if (mode === 'new') {
        await createMeal.mutateAsync({
          name: newMealName.trim(),
          recipe_ids: recipeIds,
          is_template: newIsTemplate || undefined,
          scheduled_date: newScheduledDate || undefined,
          meal_type: (newMealType as 'breakfast' | 'lunch' | 'dinner' | 'snack') ?? undefined,
        })
      } else {
        await addRecipes.mutateAsync({
          mealId: selectedMealId!,
          data: { recipe_ids: recipeIds },
        })
      }
      onClose()
    } catch {
      // errors handled by hook toast
    }
  }

  return (
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
            {t('meals.addToMeal', 'Add to meal')}
          </SheetTitle>
          <SheetDescription className="sr-only">
            {t('meals.selectMeal', 'Select a meal')}
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-6">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className={MEAL_FORM_SECTION}>
                <p className={MEAL_FORM_LABEL}>{t('meals.mode', 'Mode')}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('existing')
                    }}
                    className={cn(
                      'h-10 rounded-xl border text-sm font-semibold transition-colors',
                      mode === 'existing'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-transparent bg-[#F5EFE6] text-stone-500 hover:text-stone-700',
                    )}
                  >
                    {t('meals.selectMeal', 'Select a meal')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('new')
                      setSelectedMealId(null)
                    }}
                    className={cn(
                      'h-10 rounded-xl border text-sm font-semibold transition-colors',
                      mode === 'new'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-transparent bg-[#F5EFE6] text-stone-500 hover:text-stone-700',
                    )}
                  >
                    {t('meals.createNew', 'Create new meal')}
                  </button>
                </div>
              </div>

              {mode === 'new' && (
                <>
                  <div className={MEAL_FORM_SECTION}>
                    <label className={MEAL_FORM_LABEL}>
                      {t('meals.name', 'Meal name')}
                    </label>
                    <Input
                      autoFocus
                      value={newMealName}
                      onChange={(e) => setNewMealName(e.target.value)}
                      placeholder={t('meals.namePlaceholder', 'e.g. Weekend BBQ')}
                      className={MEAL_FORM_INPUT}
                    />
                  </div>

                  <div className={MEAL_FORM_SECTION}>
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
                        checked={newIsTemplate}
                        onCheckedChange={setNewIsTemplate}
                      />
                    </div>
                  </div>

                  <div className={MEAL_FORM_SECTION}>
                    <label className={MEAL_FORM_LABEL}>
                      {t('meals.scheduledDate', 'Date')}
                    </label>
                    <DateInput
                      value={newScheduledDate}
                      onChange={(e) => setNewScheduledDate(e.target.value)}
                      className={MEAL_FORM_INPUT}
                    />
                    {newNeedsDate && (
                      <p className="text-[11px] text-amber-600 mt-1">
                        {t('meals.dateRequiredHint', 'A date is required for non-template meals')}
                      </p>
                    )}
                  </div>

                  <div className={MEAL_FORM_SECTION}>
                    <label className={MEAL_FORM_LABEL}>
                      {t('meals.mealType', 'Meal type')}
                    </label>
                    <MealTypeSelector value={newMealType} onChange={setNewMealType} />
                  </div>
                </>
              )}

              <div className={MEAL_FORM_SECTION}>
                <p className={MEAL_FORM_LABEL}>{t('meals.selectMeal', 'Select a meal')}</p>
                {!hasMeals ? (
                  <p className="py-3 text-center text-sm text-muted-foreground">
                    {t('meals.noMeals', 'No meals yet')}
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {meals?.map((meal) => (
                      <button
                        key={meal.id}
                        type="button"
                        onClick={() => {
                          setMode('existing')
                          setSelectedMealId(meal.id)
                        }}
                        className={cn(
                          'flex items-center gap-3 rounded-xl border p-3 text-left transition-colors',
                          mode === 'existing' && selectedMealId === meal.id
                            ? 'border-primary bg-primary/10'
                            : 'border-transparent bg-[#F5EFE6] hover:bg-[#f1e7db]',
                        )}
                      >
                        <div
                          className={cn(
                            'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                            mode === 'existing' && selectedMealId === meal.id
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/40',
                          )}
                        >
                          {mode === 'existing' && selectedMealId === meal.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Plus className="h-3 w-3 text-stone-400" />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
                          <span className="truncate text-sm font-medium">{meal.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {t('meals.recipeCount', '{{count}} recipes', {
                                count: meal.recipes.length,
                              })}
                            </span>
                            {meal.scheduled_date && (
                              <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {format(parseISO(meal.scheduled_date), 'MMM d')}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div
          className="px-5 pt-3 pb-4 border-t border-stone-100 bg-white shrink-0 flex gap-2.5"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
        >
          <Button className={MEAL_FORM_SECONDARY_BUTTON} onClick={onClose} disabled={isPending}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button className={MEAL_FORM_PRIMARY_BUTTON} onClick={handleSubmit} disabled={!canSubmit}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t('meals.addToMeal', 'Add to meal')
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
