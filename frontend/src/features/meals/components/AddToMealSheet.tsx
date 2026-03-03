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
import { useMeals, useCreateMeal, useAddRecipesToMeal } from '@/features/meals/hooks/useMeals'

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

  const isPending = createMeal.isPending || addRecipes.isPending

  // Reset state when sheet opens/closes
  const handleOpenChange = useCallback(
    (v: boolean) => {
      if (!v) {
        setMode(hasMeals ? 'existing' : 'new')
        setSelectedMealId(null)
        setNewMealName('')
        onClose()
      }
    },
    [hasMeals, onClose],
  )

  const canSubmit =
    !isPending &&
    recipeIds.length > 0 &&
    (mode === 'new' ? newMealName.trim().length > 0 : selectedMealId !== null)

  const handleSubmit = async () => {
    if (!canSubmit) return

    try {
      if (mode === 'new') {
        await createMeal.mutateAsync({ name: newMealName.trim(), recipe_ids: recipeIds })
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
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
        <SheetHeader className="mb-4">
          <SheetTitle>{t('meals.addToMeal', 'Add to meal')}</SheetTitle>
          <SheetDescription className="sr-only">
            {t('meals.selectMeal', 'Select a meal')}
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto">
            {/* Create new meal option */}
            <button
              type="button"
              onClick={() => {
                setMode('new')
                setSelectedMealId(null)
              }}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                mode === 'new'
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:bg-muted/50'
              }`}
            >
              <div
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  mode === 'new'
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-muted-foreground/40'
                }`}
              >
                {mode === 'new' ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
              </div>
              <span className="text-sm font-medium">
                {t('meals.createNew', 'Create new meal')}
              </span>
            </button>

            {/* Inline name input when creating new */}
            {mode === 'new' && (
              <div className="pl-8">
                <Input
                  autoFocus
                  value={newMealName}
                  onChange={(e) => setNewMealName(e.target.value)}
                  placeholder={t('meals.namePlaceholder', 'e.g. Weekend BBQ')}
                  className="h-9"
                />
              </div>
            )}

            {/* Existing meals list */}
            {!hasMeals && mode !== 'new' && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t('meals.noMeals', 'No meals yet')}
              </p>
            )}

            {meals?.map((meal) => (
              <button
                key={meal.id}
                type="button"
                onClick={() => {
                  setMode('existing')
                  setSelectedMealId(meal.id)
                }}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                  mode === 'existing' && selectedMealId === meal.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    mode === 'existing' && selectedMealId === meal.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-muted-foreground/40'
                  }`}
                >
                  {mode === 'existing' && selectedMealId === meal.id && (
                    <Check className="h-3 w-3" />
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
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {format(parseISO(meal.scheduled_date), 'MMM d')}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button className="flex-1" onClick={handleSubmit} disabled={!canSubmit}>
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
