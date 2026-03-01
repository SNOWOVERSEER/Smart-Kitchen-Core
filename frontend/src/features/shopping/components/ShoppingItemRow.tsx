import { useState } from 'react'
import { motion } from 'framer-motion'
import { Trash2, Check, Pencil, BookOpen, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useToggleShoppingItem, useDeleteShoppingItem } from '@/features/shopping/hooks/useShoppingList'
import type { ShoppingItem } from '@/shared/lib/api.types'
import { parseShoppingNote } from '@/features/shopping/lib/shoppingNoteMeta'

interface Props {
  item: ShoppingItem
  onEdit: (item: ShoppingItem) => void
}

export function ShoppingItemRow({ item, onEdit }: Props) {
  const { t } = useTranslation()
  const toggleItem = useToggleShoppingItem()
  const removeItem = useDeleteShoppingItem()

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isRemoving, setIsRemoving] = useState(false)

  function closeDeleteConfirm() {
    setIsDeleteConfirmOpen(false)
  }

  function handleDeleteTriggerClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    if (isRemoving || removeItem.isPending) return
    setIsDeleteConfirmOpen((v) => !v)
  }

  function handleRemoveConfirmClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    if (isRemoving || removeItem.isPending) return
    setIsRemoving(true)
    removeItem.mutate(item.id, {
      onSettled: () => {
        setIsRemoving(false)
        setIsDeleteConfirmOpen(false)
      },
    })
  }

  const isChecked = item.is_checked
  const hasQty = item.quantity != null || item.unit
  const parsedNote = parseShoppingNote(item.note)
  const visibleNote = parsedNote.visibleNote
  const count = parsedNote.meta.count ?? 1

  return (
    <div className="relative overflow-hidden" onClick={() => {
      if (isDeleteConfirmOpen && !isRemoving && !removeItem.isPending) closeDeleteConfirm()
    }}>
      <div className="relative z-10 w-full bg-white flex items-center gap-3 px-4 py-3.5">
        {/* Custom circular checkbox */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (isDeleteConfirmOpen) closeDeleteConfirm()
            toggleItem.mutate({ id: item.id, is_checked: !item.is_checked })
          }}
          disabled={toggleItem.isPending}
          className={`shrink-0 w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer ${
            isChecked
              ? 'bg-primary border-primary'
              : 'border-stone-300 hover:border-primary/60'
          } ${toggleItem.isPending ? 'opacity-80 animate-pulse cursor-wait' : ''}`}
          aria-label={isChecked ? 'Uncheck' : 'Check'}
        >
          {isChecked && <Check className="w-3.5 h-3.5 text-white" strokeWidth={2.5} />}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <span
            className={`text-[15px] font-medium leading-snug transition-colors ${
              isChecked ? 'line-through text-stone-400' : 'text-[#1C1612]'
            }`}
          >
            {item.item_name}
            {item.brand && (
              <span className="ml-1.5 text-xs font-normal text-stone-400">{item.brand}</span>
            )}
          </span>

          {/* Meta row: source + qty */}
          <div className="flex items-center flex-wrap gap-1.5 mt-1">
            {item.source_recipe_title ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10.5px] font-semibold leading-none">
                <BookOpen className="w-2.5 h-2.5 shrink-0" />
                {item.source_recipe_title}
              </span>
            ) : item.source === 'agent' ? (
              <span className="px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 text-[10.5px] font-medium leading-none">
                AI
              </span>
            ) : null}

            {hasQty && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold leading-none ${
                  isChecked
                    ? 'bg-stone-100 text-stone-400'
                    : 'bg-[#F5EFE6] text-stone-600'
                }`}
              >
                {item.quantity != null ? item.quantity : ''}{item.unit ? ` ${item.unit}` : ''}{count > 1 ? ` x${count}` : ''}
              </span>
            )}

            {!hasQty && !isChecked && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500">
                <AlertCircle className="w-3 h-3 shrink-0" />
                {t('shopping.missingQty')}
              </span>
            )}

            {visibleNote && (
              <span className="text-[10.5px] text-stone-400 truncate max-w-[140px]">
                {visibleNote}
              </span>
            )}
          </div>
        </div>

        {/* Actions (compact): edit + delete; confirm overlays both */}
        <div className="relative shrink-0 w-[76px] h-9 overflow-visible">
          <motion.div
            initial={false}
            animate={{ x: isDeleteConfirmOpen ? -6 : 0, opacity: isDeleteConfirmOpen ? 0 : 1 }}
            transition={{ type: 'spring', stiffness: 440, damping: 34 }}
            className={`absolute inset-y-0 right-0 flex items-center justify-end gap-1 ${
              isDeleteConfirmOpen ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onEdit(item)
              }}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-[#1C1612] hover:bg-stone-100 transition-colors cursor-pointer"
              aria-label={t('shopping.editItem')}
            >
              <Pencil className="w-[15px] h-[15px]" />
            </button>

            <button
              type="button"
              onClick={handleDeleteTriggerClick}
              disabled={isRemoving || removeItem.isPending}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-stone-400 hover:text-destructive hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-60"
              aria-label={t('shopping.deleteItem')}
            >
              <Trash2 className="w-[15px] h-[15px]" />
            </button>
          </motion.div>

          <motion.button
            type="button"
            onClick={handleRemoveConfirmClick}
            disabled={isRemoving || removeItem.isPending}
            initial={false}
            animate={{ x: isDeleteConfirmOpen ? 0 : 92, opacity: isDeleteConfirmOpen ? 1 : 0 }}
            transition={{ type: 'spring', stiffness: 440, damping: 34 }}
            className={`absolute inset-y-0 right-0 z-20 h-9 px-3 rounded-xl bg-destructive text-white text-[11px] font-semibold flex items-center gap-1.5 disabled:opacity-65 ${
              isDeleteConfirmOpen ? 'pointer-events-auto' : 'pointer-events-none'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t('shopping.deleteItem')}
          </motion.button>
        </div>
      </div>
    </div>
  )
}
