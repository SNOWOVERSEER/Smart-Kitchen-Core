import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { X, BookOpen, Info, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAddShoppingItemsBulk, useShoppingList } from '@/features/shopping/hooks/useShoppingList'
import type { RecipeIngredient } from '@/shared/lib/api.types'

const UNITS = ['pcs', 'g', 'kg', 'ml', 'L', 'tbsp', 'tsp', 'cup', 'pack', 'bunch', 'bag', 'can', 'bottle', 'box']

interface ReviewItem {
  name: string
  /** Original quantity as suggested by the recipe — for display only */
  recipeQty: number | null
  recipeUnit: string | null
  /** Purchase quantity — what the user actually wants to buy */
  buyQty: string
  buyUnit: string
  enabled: boolean
}

interface Props {
  ingredients: RecipeIngredient[]
  recipeName: string
  recipeId?: number
  open: boolean
  onClose: () => void
}

export function AddFromRecipeSheet({ ingredients, recipeName, recipeId, open, onClose }: Props) {
  const { t } = useTranslation()
  const addBulk = useAddShoppingItemsBulk()
  const { data: existingItems = [] } = useShoppingList()

  // Build set of existing unchecked item names for merge detection
  const existingNames = new Set(
    existingItems.filter((i) => !i.is_checked).map((i) => i.item_name.toLowerCase().trim())
  )

  const [items, setItems] = useState<ReviewItem[]>(() =>
    ingredients.map((ing) => ({
      name: ing.name,
      recipeQty: ing.quantity,
      recipeUnit: ing.unit,
      // Start purchase qty blank — user decides what to actually buy
      buyQty: '',
      buyUnit: ing.unit ?? '',
      enabled: !existingNames.has(ing.name.toLowerCase().trim()),
    }))
  )

  // Reset when sheet opens with new ingredients
  const [lastIngredients, setLastIngredients] = useState(ingredients)
  if (ingredients !== lastIngredients) {
    setLastIngredients(ingredients)
    setItems(
      ingredients.map((ing) => ({
        name: ing.name,
        recipeQty: ing.quantity,
        recipeUnit: ing.unit,
        buyQty: '',
        buyUnit: ing.unit ?? '',
        enabled: !existingNames.has(ing.name.toLowerCase().trim()),
      }))
    )
  }

  const activeItems = items.filter((i) => i.enabled)
  const activeCount = activeItems.length
  const alreadyInListCount = items.filter(
    (i) => existingNames.has(i.name.toLowerCase().trim())
  ).length

  function toggleItem(idx: number) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, enabled: !item.enabled } : item))
    )
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateBuyQty(idx: number, val: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, buyQty: val } : item))
    )
  }

  function updateBuyUnit(idx: number, val: string) {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, buyUnit: val } : item))
    )
  }

  function handleSubmit() {
    if (activeCount === 0) return
    const payload = activeItems.map((item) => {
      const qty = item.buyQty.trim() !== '' ? parseFloat(item.buyQty) : undefined
      return {
        item_name: item.name,
        quantity: !isNaN(qty ?? NaN) ? qty : undefined,
        unit: item.buyUnit.trim() || undefined,
        source: 'recipe' as const,
        source_recipe_id: recipeId,
        source_recipe_title: recipeName,
      }
    })
    addBulk.mutate(payload, {
      onSuccess: () => onClose(),
    })
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl max-h-[88dvh] flex flex-col p-0 bg-[#FFFEF9]"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-full bg-stone-200" />
        </div>

        {/* Header */}
        <SheetHeader className="px-5 pt-1 pb-4 border-b border-stone-100 shrink-0">
          <div className="flex items-start gap-3">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#C97B5C' }}
            >
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <SheetTitle
                className="text-[1.1rem] leading-tight text-[#1C1612]"
                style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
              >
                {t('recipes.addMissingReview')}
              </SheetTitle>
              <p className="text-xs text-primary font-medium mt-0.5 truncate">{recipeName}</p>
            </div>
            {activeCount > 0 && (
              <span className="shrink-0 px-2 py-0.5 rounded-full bg-primary text-white text-[10.5px] font-bold leading-none self-start mt-0.5">
                {activeCount}
              </span>
            )}
          </div>
        </SheetHeader>

        {/* Context hint */}
        <div className="px-5 py-3 bg-[#F5EFE6]/60 border-b border-stone-100/80 shrink-0">
          <div className="flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
            <p className="text-xs text-stone-500 leading-snug">
              {t('recipes.addFromRecipeHint')}
            </p>
          </div>
        </div>

        {/* Already in list notice */}
        {alreadyInListCount > 0 && (
          <div className="mx-5 mt-3 px-3 py-2 bg-amber-50 border border-amber-200/80 rounded-xl flex items-start gap-2 shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              {t('recipes.alreadyInListWarning', { count: alreadyInListCount })}
            </p>
          </div>
        )}

        {/* Item list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5">
          {items.map((item, idx) => {
            const alreadyInList = existingNames.has(item.name.toLowerCase().trim())
            const recipeHint =
              item.recipeQty != null || item.recipeUnit
                ? `${item.recipeQty ?? ''} ${item.recipeUnit ?? ''}`.trim()
                : null

            return (
              <div
                key={idx}
                className={`rounded-2xl border transition-all ${
                  item.enabled
                    ? 'bg-white border-stone-200/80 shadow-[0_1px_6px_-2px_rgba(28,22,18,0.08)]'
                    : 'bg-stone-50 border-stone-100 opacity-50'
                }`}
              >
                {/* Row: checkbox + name + remove */}
                <div className="flex items-center gap-2.5 px-3.5 pt-3 pb-2">
                  <button
                    type="button"
                    onClick={() => toggleItem(idx)}
                    className={`shrink-0 w-5 h-5 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer ${
                      item.enabled ? 'bg-primary border-primary' : 'border-stone-300'
                    }`}
                  >
                    {item.enabled && (
                      <svg viewBox="0 0 10 8" className="w-2.5 h-2.5 text-white fill-none stroke-current stroke-[1.8]">
                        <polyline points="1,4 4,7 9,1" />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-[#1C1612]">{item.name}</span>
                    {alreadyInList && (
                      <span className="ml-2 text-[9.5px] font-bold uppercase tracking-wider text-amber-500">
                        {t('shopping.alreadyInList')}
                      </span>
                    )}
                    {recipeHint && (
                      <p className="text-[10.5px] text-stone-400 mt-0.5">
                        {t('recipes.recipeCallsFor', { amount: recipeHint })}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="w-6 h-6 flex items-center justify-center text-stone-300 hover:text-destructive transition-colors shrink-0 cursor-pointer"
                    aria-label="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Purchase qty row */}
                {item.enabled && (
                  <div className="flex items-center gap-2 px-3.5 pb-3">
                    <span className="text-[10.5px] text-stone-400 shrink-0 w-[4.5rem]">
                      {t('shopping.purchaseAs')}
                    </span>
                    <Input
                      type="number"
                      value={item.buyQty}
                      onChange={(e) => updateBuyQty(idx, e.target.value)}
                      placeholder="—"
                      className="h-7 w-16 text-xs text-center px-1.5 bg-[#F5EFE6] border-0 focus-visible:ring-primary/30 shrink-0"
                    />
                    <div className="flex-1 relative">
                      <Input
                        value={item.buyUnit}
                        onChange={(e) => updateBuyUnit(idx, e.target.value)}
                        placeholder={t('shopping.unitPlaceholder')}
                        list={`add-recipe-units-${idx}`}
                        className="h-7 text-xs bg-[#F5EFE6] border-0 focus-visible:ring-primary/30"
                      />
                      <datalist id={`add-recipe-units-${idx}`}>
                        {UNITS.map((u) => <option key={u} value={u} />)}
                      </datalist>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div
          className="px-5 pt-3 pb-4 border-t border-stone-100 bg-white shrink-0 flex gap-2.5"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer"
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={activeCount === 0 || addBulk.isPending}
            className="flex-[2] h-11 rounded-xl bg-[#1C1612] text-white font-semibold text-[13.5px] hover:bg-stone-800 transition-colors disabled:opacity-40 cursor-pointer"
          >
            {addBulk.isPending
              ? t('common.loading')
              : t('recipes.addNItems', { count: activeCount })}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
