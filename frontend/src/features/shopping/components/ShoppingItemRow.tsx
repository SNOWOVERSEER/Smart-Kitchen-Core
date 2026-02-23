import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import type { ShoppingItem } from '@/shared/lib/api.types'
import { useToggleShoppingItem, useDeleteShoppingItem } from '../hooks/useShoppingList'

interface Props {
  item: ShoppingItem
}

export function ShoppingItemRow({ item }: Props) {
  const { t } = useTranslation()
  const toggle = useToggleShoppingItem()
  const remove = useDeleteShoppingItem()

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    toggle.mutate({ id: item.id, is_checked: e.target.checked })
  }

  const handleDelete = () => {
    remove.mutate(item.id)
  }

  const quantityLabel =
    item.quantity != null && item.unit
      ? `${item.quantity} ${item.unit}`
      : item.quantity != null
        ? String(item.quantity)
        : null

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0">
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={item.is_checked}
        onChange={handleToggle}
        disabled={toggle.isPending}
        className="shrink-0 h-4 w-4 rounded border-border accent-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      />

      {/* Middle content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'text-sm font-medium text-foreground leading-snug',
              item.is_checked && 'line-through opacity-50'
            )}
          >
            {item.item_name}
          </span>
          {quantityLabel && (
            <span
              className={cn(
                'text-xs text-muted-foreground',
                item.is_checked && 'opacity-50'
              )}
            >
              {quantityLabel}
            </span>
          )}
        </div>

        {/* Source badge */}
        <div className="mt-1">
          {item.source === 'recipe' && item.source_recipe_title ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
              {t('shopping.sourceRecipe', { name: item.source_recipe_title })}
            </span>
          ) : item.source === 'manual' ? (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground border border-border">
              {t('shopping.sourceManual')}
            </span>
          ) : null}
        </div>
      </div>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={handleDelete}
        disabled={remove.isPending}
        aria-label={t('shopping.deleteItem')}
      >
        <Trash2 className="w-4 h-4" />
      </Button>
    </div>
  )
}
