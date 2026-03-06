import { useState, useEffect, useMemo, useCallback } from 'react'
import { useQueries, useQueryClient } from '@tanstack/react-query'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import {
  Loader2,
  Check,
  CircleCheck,
  CircleX,
  UtensilsCrossed,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { getSavedRecipe } from '@/features/recipes/api'
import { consumeItem } from '@/features/inventory/api'
import type { MealResponse, SavedRecipe } from '@/shared/lib/api.types'
import toast from 'react-hot-toast'

interface ConsumeIngredientsSheetProps {
  open: boolean
  onClose: () => void
  meal: MealResponse
}

interface IngredientState {
  checked: boolean
  amount: string
  unit: string
  /** 'idle' | 'consuming' | 'done' | 'failed' */
  status: 'idle' | 'consuming' | 'done' | 'failed'
}

interface ConsumeIngredient {
  name: string
  totalQuantity: number | null
  unit: string | null
  allInStock: boolean
  entries: { quantity: number | null; unit: string | null; have_in_stock: boolean; recipeTitle: string }[]
}

function aggregateForConsume(recipes: SavedRecipe[]): ConsumeIngredient[] {
  const map = new Map<string, ConsumeIngredient>()

  for (const recipe of recipes) {
    for (const ing of recipe.ingredients) {
      const key = ing.name.toLowerCase()
      if (!map.has(key)) {
        map.set(key, { name: ing.name, totalQuantity: 0, unit: ing.unit, allInStock: true, entries: [] })
      }
      const agg = map.get(key)!
      agg.entries.push({
        quantity: ing.quantity,
        unit: ing.unit,
        have_in_stock: ing.have_in_stock,
        recipeTitle: recipe.title,
      })
      if (ing.quantity != null) {
        agg.totalQuantity = (agg.totalQuantity ?? 0) + ing.quantity
      }
      if (!ing.unit) agg.unit = agg.unit ?? ing.unit
      if (!ing.have_in_stock) agg.allInStock = false
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.allInStock !== b.allInStock) return a.allInStock ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

export function ConsumeIngredientsSheet({ open, onClose, meal }: ConsumeIngredientsSheetProps) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [states, setStates] = useState<Record<string, IngredientState>>({})

  const recipeQueries = useQueries({
    queries: meal.recipes.map((r) => ({
      queryKey: ['recipes', r.recipe_id] as const,
      queryFn: () => getSavedRecipe(r.recipe_id),
      enabled: open && !!r.recipe_id,
    })),
  })

  const loadedRecipes = recipeQueries
    .map((q) => q.data)
    .filter((r): r is SavedRecipe => r != null)
  const isAllLoaded = loadedRecipes.length === meal.recipes.length
  const isLoading = recipeQueries.some((q) => q.isLoading)

  const aggregated = useMemo(() => aggregateForConsume(loadedRecipes), [loadedRecipes])

  // Build default state when recipes load or sheet opens
  const aggregatedKey = aggregated.map((a) => `${a.name}:${a.totalQuantity}:${a.allInStock}`).join('|')
  useEffect(() => {
    if (!open || aggregated.length === 0) return
    const initial: Record<string, IngredientState> = {}
    for (const agg of aggregated) {
      const key = agg.name.toLowerCase()
      const hasQty = agg.totalQuantity != null && agg.totalQuantity > 0
      initial[key] = {
        checked: agg.allInStock && hasQty,
        amount: hasQty ? String(agg.totalQuantity) : '',
        unit: agg.unit ?? '',
        status: 'idle',
      }
    }
    setStates(initial)
  }, [open, aggregatedKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const toggleChecked = useCallback((key: string) => {
    setStates((prev) => {
      const s = prev[key]
      if (!s || s.status !== 'idle') return prev
      return { ...prev, [key]: { ...s, checked: !s.checked } }
    })
  }, [])

  const setAmount = useCallback((key: string, val: string) => {
    setStates((prev) => {
      const s = prev[key]
      if (!s || s.status !== 'idle') return prev
      return { ...prev, [key]: { ...s, amount: val } }
    })
  }, [])

  const setUnit = useCallback((key: string, val: string) => {
    setStates((prev) => {
      const s = prev[key]
      if (!s || s.status !== 'idle') return prev
      return { ...prev, [key]: { ...s, unit: val } }
    })
  }, [])

  const checkedIdleCount = Object.values(states).filter((s) => s.checked && s.status === 'idle').length
  const doneCount = Object.values(states).filter((s) => s.status === 'done').length
  const failedCount = Object.values(states).filter((s) => s.status === 'failed').length
  const totalCount = aggregated.length

  async function handleConsume() {
    if (isSubmitting) return
    setIsSubmitting(true)

    let successCount = 0
    let failCount = 0

    for (const agg of aggregated) {
      const key = agg.name.toLowerCase()
      const state = states[key]
      if (!state?.checked || state.status !== 'idle') continue

      const amount = parseFloat(state.amount)
      if (Number.isNaN(amount) || amount <= 0) continue

      // Mark as consuming
      setStates((prev) => ({ ...prev, [key]: { ...prev[key], status: 'consuming' } }))

      try {
        await consumeItem({
          item_name: agg.name,
          amount,
          unit: state.unit || undefined,
          source: 'meal',
        })
        setStates((prev) => ({ ...prev, [key]: { ...prev[key], status: 'done', checked: false } }))
        successCount++
      } catch {
        // 400 = insufficient stock — not a crash, just mark as failed
        setStates((prev) => ({ ...prev, [key]: { ...prev[key], status: 'failed', checked: false } }))
        failCount++
      }
    }

    void qc.invalidateQueries({ queryKey: ['inventory'] })
    void qc.invalidateQueries({ queryKey: ['recipes'] })

    if (successCount > 0 && failCount === 0) {
      toast.success(t('meals.consumeSuccess', { count: successCount }))
      onClose()
    } else if (successCount > 0 && failCount > 0) {
      toast(t('meals.consumePartialFail', { success: successCount, fail: failCount }))
      // Keep sheet open so user can see what failed
    } else if (failCount > 0) {
      toast.error(t('meals.consumeFailed'))
    }

    setIsSubmitting(false)
  }

  // All done (nothing left to consume) — show close button instead
  const allProcessed = checkedIdleCount === 0 && (doneCount > 0 || failedCount > 0)

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[440px] flex flex-col p-0 bg-[#FFFEF9]">
        <SheetHeader className="px-5 pt-6 pb-4 border-b border-stone-100 shrink-0">
          <SheetTitle
            className="text-[1.15rem] text-[#1C1612] flex items-center gap-2"
            style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
          >
            <UtensilsCrossed className="w-5 h-5 text-emerald-600" />
            {t('meals.consumeIngredients', 'Consume Ingredients')}
          </SheetTitle>
          <SheetDescription className="text-xs text-stone-500">
            {meal.name}
          </SheetDescription>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
            </div>
          ) : !isAllLoaded ? (
            <div className="flex justify-center py-12">
              <p className="text-sm text-stone-400">{t('meals.loadingRecipes')}</p>
            </div>
          ) : aggregated.length === 0 ? (
            <div className="flex justify-center py-12">
              <p className="text-sm text-stone-400">{t('meals.noIngredients')}</p>
            </div>
          ) : (
            aggregated.map((agg) => {
              const key = agg.name.toLowerCase()
              const state = states[key]
              if (!state) return null
              const hasQty = agg.totalQuantity != null && agg.totalQuantity > 0
              const isDone = state.status === 'done'
              const isFailed = state.status === 'failed'
              const isConsuming = state.status === 'consuming'
              const isIdle = state.status === 'idle'

              return (
                <div
                  key={key}
                  className={cn(
                    'rounded-xl border p-3 transition-colors',
                    isDone && 'border-emerald-200/60 bg-emerald-50/40 opacity-60',
                    isFailed && 'border-red-200/60 bg-red-50/30',
                    isConsuming && 'border-stone-200/60 bg-stone-50/50 opacity-70',
                    isIdle && state.checked && 'border-emerald-200/80 bg-emerald-50/30',
                    isIdle && !state.checked && 'border-stone-200/60 bg-white',
                    isIdle && !agg.allInStock && !state.checked && 'border-amber-200/60 bg-amber-50/20',
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    {/* Checkbox / status icon */}
                    {isDone ? (
                      <CircleCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                    ) : isFailed ? (
                      <CircleX className="w-5 h-5 text-red-400 shrink-0" />
                    ) : isConsuming ? (
                      <Loader2 className="w-5 h-5 text-stone-400 shrink-0 animate-spin" />
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleChecked(key)}
                        className={cn(
                          'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors cursor-pointer',
                          state.checked
                            ? 'bg-emerald-500 border-emerald-500'
                            : 'border-stone-300 hover:border-stone-400',
                        )}
                      >
                        {state.checked && <Check className="w-3 h-3 text-white" />}
                      </button>
                    )}

                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm font-medium',
                        isDone && 'line-through text-stone-400',
                        isFailed && 'text-red-600',
                        isIdle && state.checked && 'text-[#1C1612]',
                        isIdle && !state.checked && 'text-stone-500',
                      )}>
                        {agg.name}
                      </p>
                      {agg.entries.length > 1 && (
                        <p className="text-[10px] text-stone-400 leading-snug mt-0.5">
                          {agg.entries.map((e, i) => (
                            <span key={i}>
                              {i > 0 && ' + '}
                              {e.quantity != null && `${e.quantity}`}
                              {e.unit && ` ${e.unit}`}
                              {` (${e.recipeTitle})`}
                            </span>
                          ))}
                        </p>
                      )}
                      {isFailed && (
                        <p className="text-[10px] text-red-500 mt-0.5">
                          {t('meals.notInStock', 'Not in stock')}
                        </p>
                      )}
                    </div>

                    {/* Status badge */}
                    {isDone ? (
                      <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        {t('meals.consumed', 'Consumed')}
                      </span>
                    ) : isFailed ? (
                      <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">
                        {t('meals.insufficientStock', 'Insufficient')}
                      </span>
                    ) : (
                      <span className={cn(
                        'shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
                        agg.allInStock
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-amber-50 text-amber-600',
                      )}>
                        {agg.allInStock ? t('meals.inStock', 'In stock') : t('meals.notInStock', 'Not in stock')}
                      </span>
                    )}
                  </div>

                  {/* Amount + unit inputs — only for idle + checked */}
                  {isIdle && state.checked && (
                    <div className="flex gap-2 mt-2.5 ml-7.5">
                      <Input
                        type="number"
                        value={state.amount}
                        onChange={(e) => setAmount(key, e.target.value)}
                        placeholder="0"
                        className="h-7 w-20 text-xs text-center bg-white border-stone-200 focus-visible:ring-emerald-300/50"
                        step="any"
                      />
                      <Input
                        value={state.unit}
                        onChange={(e) => setUnit(key, e.target.value)}
                        placeholder="unit"
                        className="h-7 w-16 text-xs bg-white border-stone-200 focus-visible:ring-emerald-300/50"
                      />
                      {!hasQty && (
                        <span className="text-[10px] text-amber-500 self-center">
                          {t('meals.noQtySpecified', 'No qty specified')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="px-5 pt-3 pb-4 border-t border-stone-100 bg-white shrink-0 flex flex-col gap-2"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
        >
          {/* Summary */}
          <div className="flex items-center justify-center gap-3 text-xs text-stone-400">
            {doneCount > 0 && (
              <span className="text-emerald-600 font-medium">{doneCount} consumed</span>
            )}
            {failedCount > 0 && (
              <span className="text-red-500 font-medium">{failedCount} failed</span>
            )}
            {checkedIdleCount > 0 && (
              <span>{checkedIdleCount} selected</span>
            )}
            {doneCount === 0 && failedCount === 0 && checkedIdleCount === 0 && (
              <span>{t('meals.consumeSummary', { count: 0, total: totalCount })}</span>
            )}
          </div>

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 h-11 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              {allProcessed ? t('common.close', 'Close') : t('common.cancel', 'Cancel')}
            </button>
            {!allProcessed && (
              <button
                type="button"
                onClick={() => void handleConsume()}
                disabled={isSubmitting || checkedIdleCount === 0}
                className="flex-[2] h-11 rounded-xl bg-emerald-600 text-white font-semibold text-[13.5px] hover:bg-emerald-700 transition-colors disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <UtensilsCrossed className="w-4 h-4" />
                    {t('meals.confirmConsume', 'Confirm & Consume')}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
