import { useState, useRef } from 'react'
import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useTranslation } from 'react-i18next'
import { ShoppingItemRow } from './ShoppingItemRow'
import { CompleteShoppingSheet } from './CompleteShoppingSheet'
import { QuickStockSheet } from './QuickStockSheet'
import {
  useShoppingList,
  useAddShoppingItem,
  useDeleteCheckedItems,
} from '../hooks/useShoppingList'
import type { ShoppingItem } from '@/shared/lib/api.types'

export function ShoppingPage() {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState('')
  const [sheetOpen, setSheetOpen] = useState(false)
  const [quickStockItem, setQuickStockItem] = useState<ShoppingItem | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: items = [], isLoading } = useShoppingList()
  const addItem = useAddShoppingItem()
  const clearChecked = useDeleteCheckedItems()

  const uncheckedItems = items.filter((item) => !item.is_checked)
  const checkedItems = items.filter((item) => item.is_checked)
  const checkedCount = checkedItems.length

  const handleAdd = () => {
    const name = inputValue.trim()
    if (!name) return
    addItem.mutate(
      { item_name: name, source: 'manual' },
      {
        onSuccess: () => {
          setInputValue('')
          inputRef.current?.focus()
        },
      }
    )
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAdd()
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Page header */}
      <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold text-foreground mb-3">
          {t('shopping.title')}
        </h1>

        {/* Add item input */}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('shopping.addItemPlaceholder')}
            className="h-10 flex-1"
          />
          <Button
            onClick={handleAdd}
            disabled={!inputValue.trim() || addItem.isPending}
            className="h-10 px-4 shrink-0"
          >
            {t('shopping.add')}
          </Button>
        </div>
      </div>

      {/* List area */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm text-muted-foreground">{t('shopping.loading')}</span>
          </div>
        ) : items.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
            <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted">
              <ShoppingCart className="w-7 h-7 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t('shopping.emptyList')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('shopping.emptyListSub')}
            </p>
          </div>
        ) : (
          <div className="pb-24">
            {/* Unchecked section */}
            {uncheckedItems.length > 0 && (
              <div>
                {checkedItems.length > 0 && (
                  <div className="px-4 py-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {t('shopping.uncheckedSection')}
                    </p>
                  </div>
                )}
                {uncheckedItems.map((item) => (
                  <ShoppingItemRow
                    key={item.id}
                    item={item}
                    onQuickStock={(i) => setQuickStockItem(i)}
                  />
                ))}
              </div>
            )}

            {/* Checked section */}
            {checkedItems.length > 0 && (
              <div>
                <div className="px-4 pt-4 pb-2 flex items-center justify-between border-t border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('shopping.checkedSection', { count: checkedCount })}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground -mr-2"
                    onClick={() => clearChecked.mutate()}
                    disabled={clearChecked.isPending}
                  >
                    {t('shopping.clearChecked')}
                  </Button>
                </div>
                {checkedItems.map((item) => (
                  <ShoppingItemRow
                    key={item.id}
                    item={item}
                    onQuickStock={(i) => setQuickStockItem(i)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky bottom bar — shown only when items are checked */}
      {checkedCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 lg:left-20 flex items-center justify-end gap-3 px-4 py-3 bg-card border-t border-border shadow-[0_-2px_12px_rgba(28,22,18,0.06)] z-10">
          <Button
            size="sm"
            className="h-8 text-xs"
            onClick={() => setSheetOpen(true)}
          >
            {t('shopping.completeShoppingButton')}
          </Button>
        </div>
      )}

      {/* Complete shopping sheet */}
      <CompleteShoppingSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        checkedItems={checkedItems}
      />

      {/* Quick stock sheet */}
      <QuickStockSheet
        item={quickStockItem}
        open={quickStockItem !== null}
        onClose={() => setQuickStockItem(null)}
      />
    </div>
  )
}
