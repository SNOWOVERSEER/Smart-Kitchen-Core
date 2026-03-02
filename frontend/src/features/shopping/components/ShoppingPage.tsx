import { useState, useRef } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { ShoppingCart, Plus, ChevronDown, ChevronUp, Sparkles, ArrowRight, Heart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TopBar } from '@/shared/components/TopBar'
import { DesktopPageHeader } from '@/shared/components/DesktopPageHeader'
import { ShoppingItemRow } from './ShoppingItemRow'
import { ItemEditSheet } from './ItemEditSheet'
import { CompleteShoppingSheet } from './CompleteShoppingSheet'
import { HeartCollectionPanel } from '@/features/recipes/components/HeartCollectionPanel'
import {
  useShoppingList,
  useAddShoppingItem,
  useDeleteCheckedItems,
} from '../hooks/useShoppingList'
import type { ShoppingItem } from '@/shared/lib/api.types'
import { useSavedRecipes } from '@/features/recipes/hooks/useRecipes'

export function ShoppingPage() {
  const { t } = useTranslation()
  const [inputValue, setInputValue] = useState('')
  const [completeSheetOpen, setCompleteSheetOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null)
  const [heartPanelOpen, setHeartPanelOpen] = useState(false)
  const [checkedSectionOpen, setCheckedSectionOpen] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  const { data: items = [], isLoading } = useShoppingList()
  const { data: savedRecipes } = useSavedRecipes()
  const addItem = useAddShoppingItem()
  const clearChecked = useDeleteCheckedItems()
  const savedCount = savedRecipes?.length ?? 0

  const uncheckedItems = items.filter((item) => !item.is_checked)
  const checkedItems = items.filter((item) => item.is_checked)
  const checkedCount = checkedItems.length
  const recipeItemCount = uncheckedItems.filter((i) => i.source === 'recipe').length

  // Merge / duplicate detection: items with same name in unchecked list
  const nameCount: Record<string, number> = {}
  for (const item of uncheckedItems) {
    const key = item.item_name.toLowerCase().trim()
    nameCount[key] = (nameCount[key] ?? 0) + 1
  }
  const duplicateNames = new Set(
    Object.entries(nameCount)
      .filter(([, count]) => count > 1)
      .map(([name]) => name)
  )

  function handleAdd() {
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

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAdd()
  }

  const savedRecipesHeartButton = (
    <button
      type="button"
      onClick={() => setHeartPanelOpen(true)}
      className="relative w-11 h-11 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
      aria-label={t('recipes.savedRecipesPanel')}
      title={t('recipes.savedRecipesPanel')}
    >
      <Heart className="w-[18px] h-[18px]" />
      {savedCount > 0 && (
        <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-primary text-white text-[9px] font-bold border border-background">
          {savedCount > 99 ? '99+' : savedCount}
        </span>
      )}
    </button>
  )

  return (
    <div className="flex flex-col h-full bg-[#FAF6F1]">
      {/* Desktop floating action dock (recipe-style) */}
      <TopBar
        actionsOnly
        extraActions={savedRecipesHeartButton}
        className="hidden lg:flex fixed top-4 right-4 z-30 rounded-xl border border-stone-200/80 bg-white/90 backdrop-blur-sm px-2 py-1.5 shadow-sm"
      />

      {/* Mobile header */}
      <div className="lg:hidden">
        <TopBar
          title={t('shopping.title')}
          mobileIcon={ShoppingCart}
          extraActions={savedRecipesHeartButton}
        />
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Hero subtitle + stats */}
        <div className="px-4 sm:px-5 pt-5 lg:pt-6 pb-3">
          <div className="hidden lg:block">
            <DesktopPageHeader
              icon={ShoppingCart}
              title={t('shopping.title')}
              subtitle={
                uncheckedItems.length > 0
                  ? t('shopping.heroSub', { count: uncheckedItems.length, recipeCount: recipeItemCount })
                  : t('shopping.heroSubEmpty')
              }
              rightSlot={uncheckedItems.length > 0 ? (
                <span className="shrink-0 px-2.5 py-1 rounded-full bg-stone-200/70 text-stone-500 text-[11px] font-semibold">
                  {t('shopping.draftLabel')}
                </span>
              ) : undefined}
            />
          </div>

          <div className="lg:hidden flex items-end justify-between gap-3">
            <div>
              <h1
                className="text-[clamp(1.45rem,5.5vw,1.85rem)] leading-[1.06] tracking-[-0.01em] text-[#1C1612]"
                style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
              >
                {t('shopping.heroTitle')}
              </h1>
              <p className="mt-1.5 text-sm text-stone-500 leading-snug">
                {uncheckedItems.length > 0
                  ? t('shopping.heroSub', { count: uncheckedItems.length, recipeCount: recipeItemCount })
                  : t('shopping.heroSubEmpty')}
              </p>
            </div>
            {uncheckedItems.length > 0 && (
              <span className="shrink-0 px-2.5 py-1 rounded-full bg-stone-200/70 text-stone-500 text-[11px] font-semibold">
                {t('shopping.draftLabel')}
              </span>
            )}
          </div>
        </div>

        {/* Quick-add bar */}
        <div className="px-4 sm:px-5 pb-4">
          <div className="flex items-center gap-2 bg-white rounded-2xl border border-stone-200/80 shadow-[0_2px_12px_-4px_rgba(28,22,18,0.08)] px-3.5 py-2.5">
            <Plus className="w-4 h-4 text-stone-400 shrink-0" />
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('shopping.addItemPlaceholder')}
              className="flex-1 bg-transparent text-[15px] text-[#1C1612] placeholder:text-stone-400 outline-none"
            />
            <AnimatePresence>
              {inputValue.trim() && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  type="button"
                  onClick={handleAdd}
                  disabled={addItem.isPending}
                  className="shrink-0 px-3 h-8 rounded-xl bg-[#1C1612] text-white text-xs font-semibold hover:bg-stone-800 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {t('shopping.add')}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Duplicate warning banner */}
        {duplicateNames.size > 0 && (
          <div className="mx-4 sm:mx-5 mb-4 px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-snug">
              {t('shopping.duplicateHint', { items: [...duplicateNames].join(', ') })}
            </p>
          </div>
        )}

        {/* List content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="text-sm text-stone-400">{t('shopping.loading')}</span>
          </div>
        ) : items.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center justify-center py-16 px-8 text-center gap-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-center justify-center">
              <ShoppingCart className="w-7 h-7 text-stone-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-600">{t('shopping.emptyList')}</p>
              <p className="text-xs text-stone-400 mt-1">{t('shopping.emptyListSub')}</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-primary font-medium cursor-default">
              <span>{t('shopping.emptyRecipeHint')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </motion.div>
        ) : (
          <LayoutGroup id="shopping-item-groups">
            <div className="px-4 sm:px-5 pb-32 flex flex-col gap-4">
              {/* Unchecked items */}
              {uncheckedItems.length > 0 && (
                <motion.div layout>
                  <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400 mb-2 px-1">
                    {t('shopping.uncheckedSection')} ({uncheckedItems.length})
                  </p>
                  <div className="bg-white rounded-2xl border border-stone-200/60 shadow-[0_2px_16px_-6px_rgba(28,22,18,0.09)] overflow-hidden">
                    <AnimatePresence initial={false} mode="popLayout">
                      {uncheckedItems.map((item, idx) => (
                        <motion.div
                          key={item.id}
                          layout
                          layoutId={`shopping-item-${item.id}`}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -16 }}
                          transition={{ duration: 0.22, ease: 'easeOut' }}
                          className={idx > 0 ? 'border-t border-stone-100' : ''}
                        >
                          <ShoppingItemRow
                            item={item}
                            onEdit={(i) => setEditingItem(i)}
                          />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* Checked / in-cart section */}
              {checkedItems.length > 0 && (
                <motion.div layout>
                  <div className="flex items-center justify-between mb-2 px-1">
                    <button
                      type="button"
                      onClick={() => setCheckedSectionOpen((v) => !v)}
                      className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400 hover:text-stone-600 transition-colors cursor-pointer"
                    >
                      {checkedSectionOpen
                        ? <ChevronUp className="w-3 h-3" />
                        : <ChevronDown className="w-3 h-3" />}
                      {t('shopping.checkedSection', { count: checkedCount })}
                    </button>
                    <button
                      type="button"
                      onClick={() => clearChecked.mutate()}
                      disabled={clearChecked.isPending}
                      className="text-[10.5px] font-medium text-stone-400 hover:text-destructive transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {t('shopping.clearChecked')}
                    </button>
                  </div>
                  <AnimatePresence>
                    {checkedSectionOpen && (
                      <motion.div
                        layout
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="bg-white/70 rounded-2xl border border-stone-200/50 overflow-hidden">
                          <AnimatePresence initial={false} mode="popLayout">
                            {checkedItems.map((item, idx) => (
                              <motion.div
                                key={item.id}
                                layout
                                layoutId={`shopping-item-${item.id}`}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -16 }}
                                transition={{ duration: 0.22, ease: 'easeOut' }}
                                className={idx > 0 ? 'border-t border-stone-100/80' : ''}
                              >
                                <ShoppingItemRow
                                  item={item}
                                  onEdit={(i) => setEditingItem(i)}
                                />
                              </motion.div>
                            ))}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          </LayoutGroup>
        )}
      </div>

      {/* Sticky bottom bar — shown when items are checked */}
      <AnimatePresence>
        {checkedCount > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-0 right-0 z-20 px-2.5 sm:px-4 bottom-[calc(env(safe-area-inset-bottom)+clamp(4.4rem,8.2vh,6.2rem))] lg:bottom-4 lg:left-20"
          >
            <div className="mx-auto w-full max-w-[620px] lg:max-w-[900px] rounded-2xl border border-stone-200/80 bg-white/92 backdrop-blur-md shadow-[0_18px_38px_-18px_rgba(28,22,18,0.42)] px-4 py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-stone-700">
                  {t('shopping.checkedCount', { count: checkedCount })}
                </p>
                <p className="text-[10.5px] text-stone-400 mt-0.5">{t('shopping.completeHint')}</p>
              </div>
              <button
                type="button"
                onClick={() => setCompleteSheetOpen(true)}
                className="shrink-0 h-10 px-5 rounded-xl bg-[#1C1612] text-white text-sm font-semibold hover:bg-stone-800 transition-colors cursor-pointer"
              >
                {t('shopping.completeShoppingButton')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Complete shopping sheet */}
      <CompleteShoppingSheet
        open={completeSheetOpen}
        onClose={() => setCompleteSheetOpen(false)}
        checkedItems={checkedItems}
      />

      {/* Item edit sheet */}
      <ItemEditSheet
        item={editingItem}
        open={editingItem !== null}
        onClose={() => setEditingItem(null)}
      />

      <HeartCollectionPanel
        open={heartPanelOpen}
        onClose={() => setHeartPanelOpen(false)}
      />
    </div>
  )
}
