import { useState } from 'react'
import { motion, useMotionValue, animate, AnimatePresence } from 'framer-motion'
import { Trash2, ChevronDown, ChevronUp, Zap } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useTranslation } from 'react-i18next'
import {
  useToggleShoppingItem,
  useDeleteShoppingItem,
  useUpdateShoppingItem,
} from '@/features/shopping/hooks/useShoppingList'
import type { ShoppingItem } from '@/shared/lib/api.types'

interface Props {
  item: ShoppingItem
  onQuickStock: (item: ShoppingItem) => void
}

export function ShoppingItemRow({ item, onQuickStock }: Props) {
  const { t } = useTranslation()
  const [editingQty, setEditingQty] = useState(false)
  const [qtyDraft, setQtyDraft] = useState(String(item.quantity ?? ''))
  const [expanded, setExpanded] = useState(false)
  const [noteDraft, setNoteDraft] = useState<string>(item.note ?? '')

  const toggleItem = useToggleShoppingItem()
  const removeItem = useDeleteShoppingItem()
  const updateItem = useUpdateShoppingItem()

  const dragX = useMotionValue(0)

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x < -60) {
      void animate(dragX, -300, { duration: 0.2 }).then(() => {
        removeItem.mutate(item.id)
      })
    } else {
      void animate(dragX, 0, { type: 'spring', stiffness: 400, damping: 40 })
    }
  }

  function handleQtyBlur() {
    const val = parseFloat(qtyDraft)
    if (!isNaN(val) && val !== item.quantity) {
      updateItem.mutate({ id: item.id, update: { quantity: val } })
    }
    setEditingQty(false)
  }

  function handleNoteBlur() {
    const noteValue = noteDraft || undefined
    const prevNote = item.note ?? undefined
    if (noteValue !== prevNote) {
      updateItem.mutate({ id: item.id, update: { note: noteValue } })
    }
  }

  const isChecked = item.is_checked

  return (
    <div className="relative overflow-hidden border-b border-border last:border-b-0">
      {/* Delete background */}
      <div className="absolute inset-y-0 right-0 w-20 bg-destructive flex items-center justify-center">
        <Trash2 className="w-4 h-4 text-destructive-foreground" />
      </div>

      {/* Draggable row */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={0.1}
        dragMomentum={false}
        style={{ x: dragX, backgroundColor: 'var(--card)' }}
        onDragEnd={handleDragEnd}
        className="flex items-center gap-3 px-4 py-3"
      >
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => toggleItem.mutate({ id: item.id, is_checked: e.target.checked })}
          className="shrink-0 h-4 w-4 rounded border-border accent-foreground cursor-pointer"
        />

        <div className="flex-1 min-w-0">
          <span className={`text-sm font-medium ${isChecked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {item.item_name}
          </span>
          {item.source_recipe_title && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {t('shopping.sourceRecipe', { name: item.source_recipe_title })}
            </p>
          )}
        </div>

        {/* Quantity badge — tap to edit */}
        {editingQty ? (
          <Input
            autoFocus
            type="number"
            value={qtyDraft}
            onChange={(e) => setQtyDraft(e.target.value)}
            onBlur={handleQtyBlur}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            className="w-20 h-7 text-xs text-center px-2"
          />
        ) : (
          (item.quantity != null || item.unit != null) && (
            <button
              type="button"
              onClick={() => { setQtyDraft(String(item.quantity ?? '')); setEditingQty(true) }}
              className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full hover:bg-accent transition-colors shrink-0"
            >
              {item.quantity != null ? item.quantity : ''}{item.unit ? ` ${item.unit}` : ''}
            </button>
          )
        )}

        {/* Expand toggle */}
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label={expanded ? t('shopping.collapseRow') : t('shopping.expandRow')}
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {/* Quick Stock button */}
        <button
          type="button"
          onClick={() => onQuickStock(item)}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          aria-label={t('shopping.quickStockTitle')}
        >
          <Zap className="w-3.5 h-3.5" />
        </button>
      </motion.div>

      {/* Expandable note section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden bg-muted/30"
          >
            <div className="px-4 py-2">
              <Input
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                onBlur={handleNoteBlur}
                placeholder={t('shopping.notePlaceholder')}
                className="h-8 text-xs bg-background"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
