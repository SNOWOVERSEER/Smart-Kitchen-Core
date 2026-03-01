import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Users, CheckCircle2, AlertCircle, Trash2, Plus, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useDeleteRecipe } from '@/features/recipes/hooks/useRecipes'
import { useAddShoppingItem } from '@/features/shopping/hooks/useShoppingList'
import { AddFromRecipeSheet } from './AddFromRecipeSheet'
import type { RecipeCard, SavedRecipe, RecipeIngredient } from '@/shared/lib/api.types'

interface Props {
  recipe: RecipeCard | SavedRecipe | null
  open: boolean
  onClose: () => void
  onSave?: () => void
  onSkip?: () => void
  savedRecipeId?: number
}

const TAG_GRADIENT_MAP: Record<string, string> = {
  asian: 'from-orange-200 to-amber-100',
  italian: 'from-green-200 to-yellow-100',
  desserts: 'from-pink-200 to-purple-100',
  vegetarian: 'from-green-200 to-emerald-100',
  vegan: 'from-teal-200 to-green-100',
  protein: 'from-red-200 to-orange-100',
  comfort: 'from-amber-200 to-orange-100',
}

export function RecipeDetailOverlay({ recipe, open, onClose, onSave, onSkip, savedRecipeId }: Props) {
  const { t } = useTranslation()
  const isSaved = savedRecipeId != null
  const missingIngredients = recipe ? recipe.ingredients.filter(i => !i.have_in_stock) : []
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set())
  const deleteRecipe = useDeleteRecipe()
  const addItem = useAddShoppingItem()

  // Reset added state when recipe changes
  useEffect(() => { setAddedItems(new Set()) }, [recipe?.title])

  function handleAddIngredientToList(ing: RecipeIngredient) {
    if (addedItems.has(ing.name) || !recipe) return
    addItem.mutate(
      {
        item_name: ing.name,
        quantity: ing.quantity ?? undefined,
        unit: ing.unit ?? undefined,
        source: 'recipe',
        source_recipe_title: recipe.title,
      },
      { onSuccess: () => setAddedItems((prev) => new Set(prev).add(ing.name)) }
    )
  }

  const firstTag = recipe?.tags[0]?.toLowerCase() ?? ''
  const gradientKey = Object.keys(TAG_GRADIENT_MAP).find(k => firstTag.includes(k))
  const gradientClass = gradientKey ? TAG_GRADIENT_MAP[gradientKey] : 'from-amber-100 to-stone-100'

  return (
    <>
      <AnimatePresence>
        {open && recipe && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />

            {/* Detail card */}
            <motion.div
              className="fixed inset-x-3 bottom-3 top-10 z-50 rounded-3xl border-2 border-border shadow-2xl overflow-hidden flex flex-col bg-[#FFFEF9] lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2 lg:w-[720px] lg:top-12 lg:bottom-auto lg:max-h-[88vh] lg:flex-row"
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 8 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/25 text-white hover:bg-black/50 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Hero image — full width on mobile, left column on desktop */}
              <div className="relative h-56 shrink-0 overflow-hidden lg:w-2/5 lg:h-auto">
                {'image_url' in recipe && recipe.image_url ? (
                  <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradientClass}`} />
                )}
                {/* Title overlay — mobile only */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/65 to-transparent px-5 py-4 lg:hidden">
                  <h2 className="font-display text-2xl font-bold text-white leading-tight">{recipe.title}</h2>
                </div>
              </div>

              {/* Scrollable content */}
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
                  {/* Title — desktop only */}
                  <h2 className="hidden lg:block font-display text-3xl font-bold text-[#1C1612] leading-tight">
                    {recipe.title}
                  </h2>

                  {/* Tags */}
                  {recipe.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {recipe.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-3 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-semibold uppercase tracking-wider"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Meta */}
                  {(recipe.cook_time_min != null || recipe.servings != null) && (
                    <div className="flex items-center gap-6 pb-4 border-b border-stone-200">
                      {recipe.cook_time_min != null && (
                        <div>
                          <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-0.5">
                            {t('recipes.time')}
                          </p>
                          <p className="font-medium text-[#1C1612] text-sm flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                            {t('recipes.cookTime', { min: recipe.cook_time_min })}
                          </p>
                        </div>
                      )}
                      {recipe.servings != null && (
                        <div>
                          <p className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold mb-0.5">
                            {t('recipes.servingsLabel')}
                          </p>
                          <p className="font-medium text-[#1C1612] text-sm flex items-center gap-1">
                            <Users className="w-3.5 h-3.5 shrink-0 text-stone-400" />
                            {t('recipes.servings', { count: recipe.servings })}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Ingredients */}
                  <div>
                    <h3 className="font-display text-xl font-semibold text-[#1C1612] mb-1">
                      {t('recipes.ingredients')}
                    </h3>
                    <ul className="flex flex-col divide-y divide-stone-100">
                      {recipe.ingredients.map((ing) => {
                        const isGreen = ing.have_in_stock && (ing.coverage_ratio === null || ing.coverage_ratio > 1.1)
                        const isAmber =
                          (ing.have_in_stock && ing.coverage_ratio != null && ing.coverage_ratio <= 1.1) ||
                          (!ing.have_in_stock && ing.coverage_ratio != null && ing.coverage_ratio >= 0.75)
                        // Estimated available quantity (coverage ratio × required, rounded sensibly)
                        const availQty = ing.coverage_ratio != null && ing.quantity != null
                          ? (() => {
                              const raw = ing.coverage_ratio * ing.quantity
                              return raw >= 10 ? Math.round(raw) : Math.round(raw * 10) / 10
                            })()
                          : null
                        const isAdded = addedItems.has(ing.name)
                        return (
                          <li key={ing.name} className="flex items-center gap-2.5 py-2.5">
                            {/* Name + status sub-row */}
                            <div className="flex-1 min-w-0">
                              <p className="text-[13.5px] font-medium text-[#1C1612] leading-snug">{ing.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                {/* Status: icon + label */}
                                <span className={`inline-flex items-center gap-0.5 text-[10.5px] font-semibold ${
                                  isGreen ? 'text-emerald-600' : isAmber ? 'text-amber-500' : 'text-stone-400'
                                }`}>
                                  {isGreen
                                    ? <CheckCircle2 className="w-3 h-3" />
                                    : isAmber
                                      ? <AlertCircle className="w-3 h-3" />
                                      : <span className="w-3 h-3 flex items-center justify-center"><span className="w-1.5 h-1.5 rounded-full bg-stone-300 inline-block" /></span>
                                  }
                                  {isGreen ? t('recipes.inStockLabel') : isAmber ? t('recipes.checkAmountLabel') : t('recipes.notInStockLabel')}
                                </span>
                                {availQty != null && (
                                  <span className="text-[10.5px] text-stone-400 tabular-nums">
                                    · {t('recipes.haveQty')} ~{availQty}{ing.unit ? ` ${ing.unit}` : ''}
                                  </span>
                                )}
                                {ing.quantity != null && (
                                  <span className="text-[10.5px] text-stone-400 tabular-nums">
                                    · {t('recipes.needQty')} {ing.quantity}{ing.unit ? ` ${ing.unit}` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Add to shopping list */}
                            <button
                              type="button"
                              onClick={() => handleAddIngredientToList(ing)}
                              disabled={isAdded}
                              className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                                isAdded
                                  ? 'bg-emerald-500 text-white cursor-default'
                                  : 'bg-stone-100 text-stone-400 hover:bg-primary/10 hover:text-primary'
                              }`}
                              aria-label={`Add ${ing.name} to shopping list`}
                            >
                              {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>

                  {/* Instructions */}
                  {recipe.instructions.length > 0 && (
                    <div>
                      <h3 className="font-display text-xl font-semibold text-[#1C1612] mb-3">
                        {t('recipes.instructions')}
                      </h3>
                      <ol className="flex flex-col gap-4">
                        {recipe.instructions.map((step, idx) => (
                          <li key={idx} className="flex gap-4 text-sm text-stone-700">
                            <span className="shrink-0 font-display font-bold text-primary/50 text-xl leading-none mt-0.5">
                              {idx + 1}
                            </span>
                            <span className="leading-relaxed pt-0.5">{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>

                {/* Footer actions */}
                <div className="px-5 py-4 border-t border-stone-200 bg-[#FFFEF9] shrink-0 flex flex-col gap-2.5">
                  {isSaved ? (
                    <>
                      {missingIngredients.length > 0 && (
                        <button
                          onClick={() => setAddSheetOpen(true)}
                          className="w-full py-2.5 bg-[#1C1612] text-white rounded-2xl font-semibold text-sm hover:bg-stone-800 transition-colors"
                        >
                          {t('recipes.addMissingToList')}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (savedRecipeId) deleteRecipe.mutate(savedRecipeId, { onSuccess: onClose })
                        }}
                        disabled={deleteRecipe.isPending}
                        className="w-full py-2.5 bg-red-50 text-red-600 rounded-2xl font-semibold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Trash2 className="w-4 h-4" />
                        {t('recipes.deleteRecipe')}
                      </button>
                    </>
                  ) : (
                    <div className="flex gap-3">
                      <button
                        onClick={onSkip}
                        className="flex-1 py-2.5 bg-stone-100 text-stone-600 rounded-2xl font-semibold text-sm hover:bg-stone-200 transition-colors"
                      >
                        {t('recipes.skip')}
                      </button>
                      <button
                        onClick={onSave}
                        className="flex-1 py-2.5 bg-primary text-white rounded-2xl font-semibold text-sm hover:bg-primary/90 transition-colors"
                      >
                        {t('recipes.save')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* AddFromRecipeSheet — outside AnimatePresence to avoid unmount issues */}
      {recipe && (
        <AddFromRecipeSheet
          ingredients={missingIngredients}
          recipeName={recipe.title}
          recipeId={savedRecipeId}
          open={addSheetOpen}
          onClose={() => setAddSheetOpen(false)}
        />
      )}
    </>
  )
}
