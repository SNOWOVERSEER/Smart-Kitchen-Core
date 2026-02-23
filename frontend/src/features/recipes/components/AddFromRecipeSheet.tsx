import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAddShoppingItemsBulk } from '@/features/shopping/hooks/useShoppingList'
import type { RecipeIngredient } from '@/shared/lib/api.types'

interface ReviewItem {
  name: string
  quantity: number | null
  unit: string | null
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

  const [items, setItems] = useState<ReviewItem[]>(() =>
    ingredients.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      enabled: true,
    }))
  )

  // Reset when sheet opens with new ingredients
  const [lastIngredients, setLastIngredients] = useState(ingredients)
  if (ingredients !== lastIngredients) {
    setLastIngredients(ingredients)
    setItems(ingredients.map((ing) => ({
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      enabled: true,
    })))
  }

  const activeItems = items.filter((i) => i.enabled)
  const activeCount = activeItems.length

  function toggleItem(idx: number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, enabled: !item.enabled } : item))
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateQty(idx: number, val: string) {
    const num = parseFloat(val)
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, quantity: isNaN(num) ? null : num } : item))
  }

  function updateUnit(idx: number, val: string) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, unit: val || null } : item))
  }

  function handleSubmit() {
    if (activeCount === 0) return
    const payload = activeItems.map((item) => ({
      item_name: item.name,
      quantity: item.quantity ?? undefined,
      unit: item.unit ?? undefined,
      source: 'recipe' as const,
      source_recipe_id: recipeId,
      source_recipe_title: recipeName,
    }))
    addBulk.mutate(payload, {
      onSuccess: () => onClose(),
    })
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] flex flex-col pb-safe">
        <SheetHeader className="mb-4 shrink-0">
          <SheetTitle>
            {t('recipes.addMissingReview')}
            {activeCount > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {activeCount}
              </span>
            )}
          </SheetTitle>
          <p className="text-sm text-muted-foreground truncate">{recipeName}</p>
        </SheetHeader>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {items.map((item, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                item.enabled ? 'bg-card border-border' : 'bg-muted/50 border-transparent opacity-50'
              }`}
            >
              <input
                type="checkbox"
                checked={item.enabled}
                onChange={() => toggleItem(idx)}
                className="shrink-0 h-4 w-4 rounded border-border accent-foreground cursor-pointer"
              />
              <span className="flex-1 text-sm font-medium text-foreground min-w-0 truncate">
                {item.name}
              </span>
              <Input
                type="number"
                value={item.quantity ?? ''}
                onChange={(e) => updateQty(idx, e.target.value)}
                placeholder="qty"
                className="h-7 w-16 text-xs text-center px-1 shrink-0"
                disabled={!item.enabled}
              />
              <Input
                value={item.unit ?? ''}
                onChange={(e) => updateUnit(idx, e.target.value)}
                placeholder="unit"
                className="h-7 w-16 text-xs px-2 shrink-0"
                disabled={!item.enabled}
              />
              <button
                type="button"
                onClick={() => removeItem(idx)}
                className="p-1 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                aria-label="Remove"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-3 mt-4 shrink-0">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={activeCount === 0 || addBulk.isPending}
          >
            {addBulk.isPending
              ? t('common.loading')
              : t('recipes.addNItems', { count: activeCount })}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
