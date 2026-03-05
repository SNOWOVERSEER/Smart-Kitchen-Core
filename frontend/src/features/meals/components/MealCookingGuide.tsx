import { useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQueries } from '@tanstack/react-query'
import {
  X,
  Loader2,
  Check,
  AlertCircle,
  ChefHat,
  Clock,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { getSavedRecipe } from '@/features/recipes/api'
import type { MealResponse, SavedRecipe } from '@/shared/lib/api.types'
import { MEAL_TYPE_CONFIG, EASE_OUT_EXPO } from '@/features/meals/lib/mealConstants'
import type { MealType } from '@/features/meals/lib/mealConstants'

interface MealCookingGuideProps {
  open: boolean
  onClose: () => void
  meal: MealResponse
}

// Aggregated ingredient row
interface AggregatedIngredient {
  name: string
  entries: { quantity: number | null; unit: string | null; have_in_stock: boolean; recipeTitle: string }[]
  allInStock: boolean
}

function aggregateIngredients(recipes: (SavedRecipe | undefined)[]): AggregatedIngredient[] {
  const map = new Map<string, AggregatedIngredient>()

  for (const recipe of recipes) {
    if (!recipe) continue
    for (const ing of recipe.ingredients) {
      const key = ing.name.toLowerCase()
      if (!map.has(key)) {
        map.set(key, { name: ing.name, entries: [], allInStock: true })
      }
      const agg = map.get(key)!
      agg.entries.push({
        quantity: ing.quantity,
        unit: ing.unit,
        have_in_stock: ing.have_in_stock,
        recipeTitle: recipe.title,
      })
      if (!ing.have_in_stock) agg.allInStock = false
    }
  }

  // Sort: missing first, then alphabetical
  return Array.from(map.values()).sort((a, b) => {
    if (a.allInStock !== b.allInStock) return a.allInStock ? 1 : -1
    return a.name.localeCompare(b.name)
  })
}

// Inner content that renders once all recipes are loaded
function CookingGuideContent({ meal, recipes, onClose }: { meal: MealResponse; recipes: (SavedRecipe | undefined)[]; onClose: () => void }) {
  const { t } = useTranslation()

  const loadedRecipes = recipes.filter((r): r is SavedRecipe => r != null)
  const isAllLoaded = loadedRecipes.length === meal.recipes.length

  const aggregated = useMemo(() => aggregateIngredients(loadedRecipes), [loadedRecipes])
  const missingCount = aggregated.filter((a) => !a.allInStock).length
  const mealType = meal.meal_type as MealType | null
  const config = mealType ? MEAL_TYPE_CONFIG[mealType] : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className={cn(
        'shrink-0 relative px-5 pt-5 pb-4 bg-gradient-to-br',
        config?.heroGradient ?? 'from-stone-100 via-stone-50 to-stone-100',
      )}>
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full bg-black/25 text-white hover:bg-black/50 transition-colors z-10"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-white/40 backdrop-blur-sm flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-white drop-shadow" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#1C1612] leading-tight">
              {t('meals.cookingGuideTitle', 'Cooking Guide')}
            </h2>
            <p className="text-xs text-stone-600/80">
              {meal.name} — {meal.recipes.length} {meal.recipes.length === 1 ? 'recipe' : 'recipes'}
            </p>
          </div>
        </div>

        <p className="text-xs text-stone-500">
          {t('meals.cookingGuideSub', 'Everything you need for this meal')}
        </p>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">
        {!isAllLoaded ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-stone-400" />
          </div>
        ) : (
          <>
            {/* Ingredients summary */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400">
                  {t('meals.ingredientsSummary', 'Ingredients Summary')}
                </p>
                {missingCount > 0 ? (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                    {t('meals.missingCount', { count: missingCount })}
                  </span>
                ) : (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">
                    {t('meals.allInStock', 'All in stock')}
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-stone-200/80 bg-white divide-y divide-stone-100">
                {aggregated.map((agg) => (
                  <div key={agg.name} className="flex items-start gap-2.5 px-3 py-2.5">
                    {agg.allInStock ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm',
                        agg.allInStock ? 'text-stone-600' : 'text-stone-800 font-medium',
                      )}>
                        {agg.name}
                      </p>
                      <p className="text-[11px] text-stone-400 leading-snug">
                        {agg.entries.map((e, i) => (
                          <span key={i}>
                            {i > 0 && ' + '}
                            {e.quantity != null && `${e.quantity}`}
                            {e.unit && ` ${e.unit}`}
                            {agg.entries.length > 1 && ` (${e.recipeTitle})`}
                          </span>
                        ))}
                      </p>
                    </div>
                    <span className={cn(
                      'shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5',
                      agg.allInStock
                        ? 'bg-emerald-50 text-emerald-600'
                        : 'bg-amber-50 text-amber-600',
                    )}>
                      {agg.allInStock ? t('meals.inStock') : t('meals.missing')}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Step-by-step instructions per recipe */}
            {loadedRecipes.map((recipe, recipeIdx) => (
              <section key={recipe.id}>
                <div className="flex items-center gap-3 mb-3">
                  {/* Recipe thumbnail */}
                  {recipe.image_url ? (
                    <img
                      src={recipe.image_url}
                      alt={recipe.title}
                      className="w-11 h-11 rounded-xl object-cover shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-stone-200 to-stone-300 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400">
                      {t('meals.recipeOf', { current: recipeIdx + 1, total: loadedRecipes.length })}
                    </p>
                    <p className="text-sm font-semibold text-[#1C1612] truncate">
                      {recipe.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-stone-400">
                    {recipe.cook_time_min && (
                      <span className="flex items-center gap-1 text-[11px]">
                        <Clock className="w-3 h-3" />
                        {recipe.cook_time_min}m
                      </span>
                    )}
                    {recipe.servings && (
                      <span className="flex items-center gap-1 text-[11px]">
                        <Users className="w-3 h-3" />
                        {recipe.servings}
                      </span>
                    )}
                  </div>
                </div>

                {/* Recipe ingredients */}
                <div className="mb-3 rounded-xl border border-stone-200/80 bg-white p-3">
                  <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-stone-400 mb-2">
                    {t('meals.ingredients')}
                  </p>
                  <div className="flex flex-col gap-1">
                    {recipe.ingredients.map((ing, i) => (
                      <div key={`${ing.name}-${i}`} className="flex items-center gap-2 text-xs">
                        {ing.have_in_stock ? (
                          <Check className="w-3 h-3 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3 h-3 text-amber-500 shrink-0" />
                        )}
                        <span className={cn(
                          'flex-1',
                          ing.have_in_stock ? 'text-stone-500' : 'text-stone-700 font-medium',
                        )}>
                          {ing.quantity != null && `${ing.quantity}`}
                          {ing.unit && ` ${ing.unit}`}
                          {(ing.quantity != null || ing.unit) && ' '}
                          {ing.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Instructions */}
                {recipe.instructions.length > 0 ? (
                  <div className="flex flex-col gap-2.5">
                    {recipe.instructions.map((step, stepIdx) => (
                      <div key={stepIdx} className="flex gap-3">
                        <div className="shrink-0 w-6 h-6 rounded-full bg-stone-100 flex items-center justify-center">
                          <span className="text-[11px] font-bold text-stone-500">
                            {stepIdx + 1}
                          </span>
                        </div>
                        <p className="flex-1 text-sm text-stone-700 leading-relaxed pt-0.5">
                          {step}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-stone-400 italic">
                    {t('meals.noInstructions')}
                  </p>
                )}

                {/* Divider between recipes */}
                {recipeIdx < loadedRecipes.length - 1 && (
                  <div className="mt-5 h-px w-full bg-gradient-to-r from-transparent via-stone-200 to-transparent" />
                )}
              </section>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

export function MealCookingGuide({ open, onClose, meal }: MealCookingGuideProps) {
  const recipeQueries = useQueries({
    queries: meal.recipes.map((r) => ({
      queryKey: ['recipes', r.recipe_id] as const,
      queryFn: () => getSavedRecipe(r.recipe_id),
      enabled: open && r.recipe_id > 0,
    })),
  })

  const recipes = recipeQueries.map((q) => q.data)

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-50 bg-stone-900/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Guide card */}
          <motion.div
            className="fixed inset-x-2 bottom-2 top-6 z-[60] rounded-3xl border-2 border-stone-200/60 shadow-2xl overflow-hidden flex flex-col bg-[#FFFEF9] lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2 lg:w-[720px] lg:top-8 lg:bottom-8 lg:max-h-[90vh]"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10 }}
            transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
            onClick={(e) => e.stopPropagation()}
          >
            <CookingGuideContent meal={meal} recipes={recipes} onClose={onClose} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
