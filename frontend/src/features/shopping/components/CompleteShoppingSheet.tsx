import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { AlertCircle, BookOpen, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ShoppingItem } from '@/shared/lib/api.types'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { parseShoppingNote } from '@/features/shopping/lib/shoppingNoteMeta'
import { addInventoryItem } from '@/features/inventory/api'
import { deleteShoppingItem } from '@/features/shopping/api'

const LOCATIONS = ['Fridge', 'Freezer', 'Pantry'] as const
const DEFAULT_LOCATION = 'Fridge'

interface ItemState {
  location: typeof LOCATIONS[number]
  pkgSize: string
  unit: string
  count: string
  expiryDate: string
}

interface Props {
  open: boolean
  onClose: () => void
  checkedItems: ShoppingItem[]
}

export function CompleteShoppingSheet({ open, onClose, checkedItems }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Per-item state: location + optional qty/unit overrides for items without them
  const [itemStates, setItemStates] = useState<Record<number, ItemState>>({})
  const checkedItemsSignature = checkedItems
    .map((i) => `${i.id}:${i.quantity ?? ''}:${i.unit ?? ''}:${i.note ?? ''}`)
    .join('|')

  // Reset state when checkedItems change (sheet opens with new set of items)
  useEffect(() => {
    if (!open) return
    const initial: Record<number, ItemState> = {}
    for (const item of checkedItems) {
      const parsed = parseShoppingNote(item.note)
      const count = parsed.meta.count ?? 1
      const pkgSize = parsed.meta.pkgSize ?? (item.quantity != null ? item.quantity / count : undefined)
      const location = (parsed.meta.location as typeof LOCATIONS[number] | undefined) ?? DEFAULT_LOCATION
      initial[item.id] = {
        location,
        pkgSize: pkgSize != null ? String(pkgSize) : '',
        unit: item.unit ?? 'pcs',
        count: String(count),
        expiryDate: parsed.meta.expiryDate ?? '',
      }
    }
    setItemStates(initial)
  }, [open, checkedItemsSignature])  // eslint-disable-line react-hooks/exhaustive-deps

  const missingQtyCount = checkedItems.filter((item) => item.quantity == null).length

  function setLocation(itemId: number, loc: typeof LOCATIONS[number]) {
    setItemStates((prev) => ({ ...prev, [itemId]: { ...prev[itemId], location: loc } }))
  }

  function setPkgSize(itemId: number, val: string) {
    setItemStates((prev) => ({ ...prev, [itemId]: { ...prev[itemId], pkgSize: val } }))
  }

  function setUnitOverride(itemId: number, val: string) {
    setItemStates((prev) => ({ ...prev, [itemId]: { ...prev[itemId], unit: val } }))
  }

  function setCount(itemId: number, val: string) {
    setItemStates((prev) => ({ ...prev, [itemId]: { ...prev[itemId], count: val } }))
  }

  function setExpiryDate(itemId: number, val: string) {
    setItemStates((prev) => ({ ...prev, [itemId]: { ...prev[itemId], expiryDate: val } }))
  }

  function handleSetAllLocation(loc: typeof LOCATIONS[number]) {
    setItemStates((prev) => {
      const updated = { ...prev }
      for (const id of Object.keys(updated)) {
        updated[Number(id)] = { ...updated[Number(id)], location: loc }
      }
      return updated
    })
  }

  const hasInvalidItem = checkedItems.some((item) => {
    const state = itemStates[item.id]
    if (!state) return true
    const pkgSize = parseFloat(state.pkgSize)
    const count = parseFloat(state.count)
    return (
      !state.pkgSize ||
      Number.isNaN(pkgSize) ||
      pkgSize <= 0 ||
      !state.count ||
      Number.isNaN(count) ||
      count <= 0 ||
      !state.unit.trim()
    )
  })

  async function handleSubmit() {
    if (isSubmitting || checkedItems.length === 0) return

    const invalidItem = checkedItems.find((item) => {
      const state = itemStates[item.id]
      if (!state) return true
      const pkgSize = parseFloat(state.pkgSize)
      const count = parseFloat(state.count)
      return (
        !state.pkgSize ||
        Number.isNaN(pkgSize) ||
        pkgSize <= 0 ||
        !state.count ||
        Number.isNaN(count) ||
        count <= 0 ||
        !state.unit.trim()
      )
    })
    if (invalidItem) {
      toast.error(t('shopping.completeInvalidFields', { name: invalidItem.item_name }))
      return
    }

    setIsSubmitting(true)
    let addedCount = 0
    const failedItems: string[] = []
    try {
      for (const item of checkedItems) {
        const state = itemStates[item.id]
        if (!state) {
          failedItems.push(item.item_name)
          continue
        }
        const pkgSize = parseFloat(state.pkgSize)
        const count = parseFloat(state.count)
        const batchCount = Math.max(1, Math.round(count))
        const payload = {
          item_name: item.item_name,
          brand: item.brand ?? undefined,
          category: item.category ?? undefined,
          quantity: pkgSize,
          unit: state.unit.trim() || 'pcs',
          location: state.location,
          total_volume: pkgSize,
          expiry_date: state.expiryDate || undefined,
        }

        try {
          await Promise.all(Array.from({ length: batchCount }, () => addInventoryItem(payload)))
          await deleteShoppingItem(item.id)
          addedCount += batchCount
        } catch {
          failedItems.push(item.item_name)
        }
      }

      void qc.invalidateQueries({ queryKey: ['shopping'] })
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      void qc.invalidateQueries({ queryKey: ['recipes'] })

      if (addedCount > 0) {
        toast.success(t('shopping.completeSuccess', { count: addedCount }))
      }
      if (failedItems.length > 0) {
        toast.error(t('shopping.completeFailed'))
      }

      if (failedItems.length === 0) {
        onClose()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[440px] flex flex-col p-0 bg-[#FFFEF9]">
        {/* Header */}
        <SheetHeader className="px-5 pt-6 pb-4 border-b border-stone-100 shrink-0">
          <SheetTitle
            className="text-[1.15rem] text-[#1C1612]"
            style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
          >
            {t('shopping.completeShoppingTitle')}
          </SheetTitle>
          <SheetDescription className="text-xs text-stone-500">
            {t('shopping.completeShoppingDescription')}
          </SheetDescription>
        </SheetHeader>

        {/* Missing qty warning */}
        {missingQtyCount > 0 && (
          <div className="mx-5 mt-4 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-snug">
              {t('shopping.missingQtyWarning', { count: missingQtyCount })}
            </p>
          </div>
        )}

        {/* Set-all-location quick row */}
        <div className="px-5 py-3 border-b border-stone-100 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500 shrink-0">{t('shopping.setAllTo')}</span>
            <div className="flex gap-1.5">
              {LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => handleSetAllLocation(loc)}
                  className="px-3 h-7 rounded-full text-xs font-medium bg-stone-100 text-stone-600 hover:bg-primary hover:text-white transition-colors cursor-pointer"
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Per-item list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
          {checkedItems.map((item) => {
            const state = itemStates[item.id]
            if (!state) return null
            const hasMissingQty = item.quantity == null

            return (
              <motion.div
                key={item.id}
                layout
                className={`rounded-2xl border p-3.5 ${
                  hasMissingQty
                    ? 'border-amber-200/80 bg-amber-50/40'
                    : 'border-stone-200/60 bg-white'
                }`}
              >
                {/* Item name + source */}
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#1C1612] leading-snug">{item.item_name}</p>
                    {item.source_recipe_title && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <BookOpen className="w-2.5 h-2.5 text-primary shrink-0" />
                        <span className="text-[10px] text-primary font-medium truncate">
                          {item.source_recipe_title}
                        </span>
                      </div>
                    )}
                  </div>
                  {hasMissingQty ? (
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                </div>

                {/* size / unit / count */}
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.9fr)] gap-2 mb-3">
                  <Input
                    type="number"
                    value={state.pkgSize}
                    onChange={(e) => setPkgSize(item.id, e.target.value)}
                    placeholder={t('shopping.sizePerPackagePlaceholder')}
                    className={`h-8 text-xs text-center bg-[#F5EFE6] border-0 focus-visible:ring-primary/30 ${
                      hasMissingQty ? 'ring-1 ring-amber-300' : ''
                    }`}
                  />
                  <Input
                    value={state.unit}
                    onChange={(e) => setUnitOverride(item.id, e.target.value)}
                    placeholder={t('shopping.unitLabel')}
                    className="h-8 text-xs bg-[#F5EFE6] border-0 focus-visible:ring-primary/30"
                  />
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-stone-400">x</span>
                    <Input
                      type="number"
                      value={state.count}
                      onChange={(e) => setCount(item.id, e.target.value)}
                      placeholder={t('shopping.countPlaceholder')}
                      className="h-8 pl-6 text-xs text-center bg-[#F5EFE6] border-0 focus-visible:ring-primary/30"
                    />
                  </div>
                </div>

                {/* expiry date */}
                <div className="mb-3">
                  <label className="text-[10px] text-stone-500 mb-1 block">
                    {t('shopping.expiryDate')}
                  </label>
                  <Input
                    type="date"
                    value={state.expiryDate}
                    onChange={(e) => setExpiryDate(item.id, e.target.value)}
                    className="h-8 text-xs bg-[#F5EFE6] border-0 focus-visible:ring-primary/30"
                  />
                </div>

                {/* Location chips */}
                <div className="flex gap-1.5">
                  {LOCATIONS.map((loc) => (
                    <button
                      key={loc}
                      type="button"
                      onClick={() => setLocation(item.id, loc)}
                      className={`flex-1 h-7 rounded-xl text-[11px] font-medium transition-colors cursor-pointer ${
                        state.location === loc
                          ? 'bg-primary text-white shadow-sm shadow-primary/20'
                          : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                </div>
              </motion.div>
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
            disabled={isSubmitting}
            className="flex-1 h-11 rounded-xl border border-stone-200 text-sm font-medium text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            {t('shopping.cancel')}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || checkedItems.length === 0 || hasInvalidItem}
            className="flex-[2] h-11 rounded-xl bg-[#1C1612] text-white font-semibold text-[13.5px] hover:bg-stone-800 transition-colors disabled:opacity-40 cursor-pointer"
          >
            {isSubmitting
              ? t('shopping.completing')
              : t('shopping.completeNItems', { count: checkedItems.length })}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
