import { useState, useEffect } from 'react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Trash2, Zap, ChevronDown, ChevronUp, BookOpen } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from 'react-i18next'
import { useUpdateShoppingItem, useDeleteShoppingItem } from '../hooks/useShoppingList'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import type { ShoppingItem } from '@/shared/lib/api.types'
import { buildShoppingNote, parseShoppingNote } from '@/features/shopping/lib/shoppingNoteMeta'
import { addInventoryItem } from '@/features/inventory/api'
import { deleteShoppingItem } from '@/features/shopping/api'

const UNITS = ['pcs', 'g', 'kg', 'ml', 'L', 'tbsp', 'tsp', 'cup', 'pack', 'bunch', 'bag', 'can', 'bottle', 'box']
const LOCATIONS = ['Fridge', 'Freezer', 'Pantry'] as const
const CATEGORIES = ['Dairy', 'Meat', 'Vegetable', 'Fruit', 'Pantry', 'Beverage', 'Snack', 'Other']

interface Props {
  item: ShoppingItem | null
  open: boolean
  onClose: () => void
}

export function ItemEditSheet({ item, open, onClose }: Props) {
  const { t } = useTranslation()
  const updateItem = useUpdateShoppingItem()
  const deleteItem = useDeleteShoppingItem()
  const queryClient = useQueryClient()

  const [inventoryPkgSize, setInventoryPkgSize] = useState('')
  const [inventoryUnit, setInventoryUnit] = useState('')
  const [inventoryCount, setInventoryCount] = useState('1')
  const [brand, setBrand] = useState('')
  const [category, setCategory] = useState('')
  const [note, setNote] = useState('')
  const [showInventory, setShowInventory] = useState(false)
  const [location, setLocation] = useState<typeof LOCATIONS[number]>('Fridge')
  const [expiryDate, setExpiryDate] = useState('')
  const [isAddingToInventory, setIsAddingToInventory] = useState(false)

  const parsedNote = parseShoppingNote(item?.note)
  const initialCount = parsedNote.meta.count ?? 1
  const initialPkgSize =
    parsedNote.meta.pkgSize ??
    (item?.quantity != null ? item.quantity / initialCount : undefined)
  const initialLocation =
    (parsedNote.meta.location as typeof LOCATIONS[number] | undefined) ?? 'Fridge'
  const initialExpiryDate = parsedNote.meta.expiryDate ?? ''

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      const parsed = parseShoppingNote(item.note)
      const count = parsed.meta.count ?? 1
      const pkgSize = parsed.meta.pkgSize ?? (item.quantity != null ? item.quantity / count : undefined)
      setInventoryPkgSize(pkgSize != null ? String(pkgSize) : '')
      setInventoryUnit(item.unit ?? '')
      setInventoryCount(String(count))
      setBrand(item.brand ?? '')
      setCategory(item.category ?? '')
      setNote(parsed.visibleNote)
      setLocation((parsed.meta.location as typeof LOCATIONS[number] | undefined) ?? 'Fridge')
      setExpiryDate(parsed.meta.expiryDate ?? '')
      setShowInventory(false)
    }
  }, [item?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null

  const pkgSizeNum = inventoryPkgSize.trim() !== '' ? parseFloat(inventoryPkgSize) : undefined
  const countNum = inventoryCount.trim() !== '' ? parseFloat(inventoryCount) : undefined
  const hasValidPkg = pkgSizeNum != null && !Number.isNaN(pkgSizeNum) && pkgSizeNum > 0
  const hasValidCount = countNum != null && !Number.isNaN(countNum) && countNum > 0
  const normalizedInitialPkgSize =
    initialPkgSize != null && Number.isFinite(initialPkgSize) && initialPkgSize > 0 ? initialPkgSize : null
  const isDirty =
    (hasValidPkg ? pkgSizeNum : null) !== normalizedInitialPkgSize ||
    (hasValidCount ? countNum : null) !== (initialCount ?? null) ||
    inventoryUnit.trim() !== (item.unit ?? '') ||
    brand.trim() !== (item.brand ?? '') ||
    category.trim() !== (item.category ?? '') ||
    note.trim() !== parsedNote.visibleNote.trim() ||
    location !== initialLocation ||
    expiryDate !== initialExpiryDate

  function handleSave() {
    if (inventoryPkgSize.trim() !== '' && !hasValidPkg) {
      toast.error(t('shopping.invalidSizePerPackage'))
      return
    }
    if (inventoryCount.trim() !== '' && !hasValidCount) {
      toast.error(t('shopping.invalidCount'))
      return
    }

    updateItem.mutate(
      {
        id: item!.id,
        update: {
          quantity: pkgSizeNum,
          unit: inventoryUnit.trim() || undefined,
          brand: brand.trim() || undefined,
          category: category.trim() || undefined,
          note: buildShoppingNote(note, {
            pkgSize: pkgSizeNum,
            count: countNum,
            location,
            expiryDate,
          }),
        },
      },
      { onSuccess: () => onClose() }
    )
  }

  function handleDelete() {
    deleteItem.mutate(item!.id, { onSuccess: () => onClose() })
  }

  async function handleAddToInventory() {
    const pkgSize = parseFloat(inventoryPkgSize)
    if (!inventoryPkgSize || Number.isNaN(pkgSize) || pkgSize <= 0) {
      toast.error(t('shopping.invalidSizePerPackage'))
      return
    }

    const count = parseFloat(inventoryCount)
    if (!inventoryCount || Number.isNaN(count) || count <= 0) {
      toast.error(t('shopping.invalidCount'))
      return
    }

    const batchCount = Math.max(1, Math.round(count))
    setIsAddingToInventory(true)
    try {
      const payload = {
        item_name: item!.item_name,
        brand: brand.trim() || undefined,
        category: category.trim() || undefined,
        quantity: pkgSize,
        unit: inventoryUnit.trim() || 'pcs',
        location,
        expiry_date: expiryDate || undefined,
        total_volume: pkgSize,
      }
      await Promise.all(Array.from({ length: batchCount }, () => addInventoryItem(payload)))
      await deleteShoppingItem(item!.id)
      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      void queryClient.invalidateQueries({ queryKey: ['shopping'] })
      void queryClient.invalidateQueries({ queryKey: ['recipes'] })
      toast.success(t('shopping.quickStockSuccess', { name: item!.item_name }))
      onClose()
    } catch {
      toast.error(t('shopping.quickStockError'))
    } finally {
      setIsAddingToInventory(false)
    }
  }

  const fromRecipe = item.source === 'recipe' && item.source_recipe_title

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl max-h-[92dvh] flex flex-col p-0 bg-[#FFFEF9] overflow-hidden gap-0"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-full bg-stone-200" />
        </div>

        {/* Header */}
        <div className="px-5 pt-1 pb-4 border-b border-stone-100 shrink-0">
          <h2
            className="text-[1.4rem] text-[#1C1612] leading-tight"
            style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
          >
            {item.item_name}
          </h2>
          {fromRecipe && (
            <div className="flex items-center gap-1.5 mt-1.5">
              <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-xs text-primary font-semibold truncate">
                {item.source_recipe_title}
              </span>
            </div>
          )}
        </div>

        {/* Scrollable form */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-6 flex flex-col gap-4">
          {/* Quantity */}
          <div className="flex flex-col gap-3">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400">
              {t('shopping.sizePerPackage')}
            </p>
            <Input
              inputMode="decimal"
              value={inventoryPkgSize}
              onChange={(e) => setInventoryPkgSize(e.target.value)}
              placeholder={t('shopping.sizePerPackagePlaceholder')}
              className="h-11 bg-[#F5EFE6] border-0 text-center text-base font-semibold focus-visible:ring-primary/30"
            />

            {/* Unit */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-stone-500">{t('shopping.unitLabel')}</label>
              {/* Quick-pick chips */}
              <div className="flex gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                {UNITS.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setInventoryUnit(u)}
                    className={`shrink-0 h-7 px-2.5 rounded-lg text-[11px] font-semibold transition-colors ${
                      inventoryUnit === u
                        ? 'bg-primary text-white shadow-sm shadow-primary/20'
                        : 'bg-[#F5EFE6] text-stone-600'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
              {/* Free-form input */}
              <Input
                value={inventoryUnit}
                onChange={(e) => setInventoryUnit(e.target.value)}
                placeholder={t('shopping.unitLabel')}
                className="h-9 bg-[#F5EFE6] border-0 focus-visible:ring-primary/30 text-sm"
              />
            </div>

            {/* Count */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-500">{t('shopping.count')}</label>
              <Input
                inputMode="numeric"
                value={inventoryCount}
                onChange={(e) => setInventoryCount(e.target.value)}
                placeholder={t('shopping.countPlaceholder')}
                className="h-10 bg-[#F5EFE6] border-0 focus-visible:ring-primary/30"
              />
            </div>
          </div>

          {/* Brand + category */}
          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)] gap-2.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-500">{t('shopping.brand')}</label>
              <Input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder={t('shopping.brandPlaceholder')}
                className="h-10 bg-[#F5EFE6] border-0 focus-visible:ring-primary/30"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-stone-500">{t('shopping.category')}</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-10 w-full bg-[#F5EFE6] border-0 focus:ring-primary/30">
                  <SelectValue placeholder={t('shopping.selectCategory')} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Note */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-stone-500">{t('shopping.note')}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('shopping.notePlaceholder')}
              rows={2}
              className="w-full bg-[#F5EFE6] rounded-xl p-3 text-sm text-[#1C1612] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* For inventory — collapsible */}
          <div className="rounded-2xl border border-stone-200">
            <button
              type="button"
              onClick={() => setShowInventory((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-stone-600 hover:bg-stone-50/80 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span>{t('shopping.forInventory')}</span>
              </div>
              {showInventory
                ? <ChevronUp className="w-4 h-4 text-stone-400" />
                : <ChevronDown className="w-4 h-4 text-stone-400" />}
            </button>
            {showInventory && (
              <div className="px-4 pb-4 pt-3 flex flex-col gap-3 border-t border-stone-100">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-stone-500">{t('shopping.location')}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {LOCATIONS.map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setLocation(loc)}
                        className={`h-9 rounded-xl text-sm font-medium transition-colors ${
                          location === loc
                            ? 'bg-primary text-white shadow-sm shadow-primary/20'
                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-stone-500">{t('shopping.expiryDate')}</label>
                  <Input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="h-10 bg-stone-50 border-stone-200"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleAddToInventory()}
                  disabled={isAddingToInventory}
                  className="w-full h-10 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  {t('shopping.addToInventoryNow')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-5 pt-3 pb-4 border-t border-stone-100 bg-white shrink-0 flex gap-2.5"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
        >
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteItem.isPending}
            className="w-11 h-11 rounded-xl border border-stone-200 flex items-center justify-center text-stone-400 hover:text-destructive hover:border-destructive/50 transition-colors shrink-0"
          >
            <Trash2 className="w-[18px] h-[18px]" />
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={updateItem.isPending || !isDirty}
            className="flex-1 h-11 rounded-xl bg-[#1C1612] text-white font-semibold text-[13.5px] hover:bg-stone-800 transition-colors disabled:opacity-40"
          >
            {t('shopping.save')}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
