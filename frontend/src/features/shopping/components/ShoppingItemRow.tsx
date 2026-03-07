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

  function handleDeleteClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    if (isRemoving || removeItem.isPending) return
    if (!isDeleteConfirmOpen) {
      setIsDeleteConfirmOpen(true)
      return
    }
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

        {/* Actions (compact): edit + morphing delete */}
        <div className="relative shrink-0 h-9 w-[104px] overflow-visible">
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(item)
            }}
            initial={false}
            animate={{
              x: isDeleteConfirmOpen ? -8 : 0,
              opacity: isDeleteConfirmOpen ? 0 : 1,
            }}
            transition={{ type: 'spring', stiffness: 360, damping: 30 }}
            className={`absolute inset-y-0 right-11 flex h-9 w-9 items-center justify-center rounded-xl text-stone-400 hover:text-[#1C1612] hover:bg-stone-100 transition-colors cursor-pointer ${
              isDeleteConfirmOpen ? 'pointer-events-none' : 'pointer-events-auto'
            }`}
            aria-label={t('shopping.editItem')}
          >
            <Pencil className="w-[15px] h-[15px]" />
          </motion.button>

          <motion.button
            type="button"
            onClick={handleDeleteClick}
            disabled={isRemoving || removeItem.isPending}
            initial={false}
            animate={{
              width: isDeleteConfirmOpen ? 98 : 36,
              backgroundColor: isDeleteConfirmOpen ? 'rgb(239 68 68)' : 'rgba(255,255,255,0.92)',
              borderColor: isDeleteConfirmOpen ? 'rgba(239,68,68,0.96)' : 'rgba(231,229,228,0.95)',
              color: isDeleteConfirmOpen ? 'rgb(255,255,255)' : 'rgb(120,113,108)',
              boxShadow: isDeleteConfirmOpen
                ? '0 14px 24px -16px rgba(239, 68, 68, 0.72)'
                : '0 4px 10px -8px rgba(0,0,0,0.16)',
            }}
            transition={{ type: 'spring', stiffness: 340, damping: 30, mass: 0.9 }}
            className="absolute inset-y-0 right-0 flex h-9 items-center justify-start overflow-hidden rounded-xl border backdrop-blur-sm disabled:opacity-65"
            style={{ transformOrigin: 'right center' }}
            aria-label={t('shopping.deleteItem')}
          >
            <motion.span
              initial={false}
              animate={{
                scale: isDeleteConfirmOpen ? 0.96 : 1,
                x: isDeleteConfirmOpen ? 1 : 0,
              }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="flex h-9 w-9 shrink-0 items-center justify-center"
            >
              <Trash2 className="w-[15px] h-[15px]" />
            </motion.span>

            <motion.span
              initial={false}
              animate={{
                opacity: isDeleteConfirmOpen ? 1 : 0,
                x: isDeleteConfirmOpen ? 0 : 8,
                filter: isDeleteConfirmOpen ? 'blur(0px)' : 'blur(2px)',
              }}
              transition={{
                duration: isDeleteConfirmOpen ? 0.18 : 0.12,
                ease: [0.22, 1, 0.36, 1],
                delay: isDeleteConfirmOpen ? 0.06 : 0,
              }}
              className="pr-3 text-[11px] font-semibold whitespace-nowrap"
            >
              {t('shopping.deleteItem')}
            </motion.span>
          </motion.button>
        </div>
      </div>
    </div>
  )
}
