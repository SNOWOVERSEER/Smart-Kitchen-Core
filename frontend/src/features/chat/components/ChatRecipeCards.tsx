import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  Users,
  ChevronDown,
  ChevronUp,
  Heart,
  CalendarPlus,
  ShoppingCart,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import type { RecipeCard, SaveRecipeRequest } from '@/shared/lib/api.types'
import { useSaveRecipe } from '@/features/recipes/hooks/useRecipes'
import { apiClient } from '@/shared/lib/axios'
import { AddToMealSheet } from '@/features/meals/components/AddToMealSheet'

interface Props {
  recipes: RecipeCard[]
}

const TAG_GRADIENT_MAP: Record<string, string> = {
  asian: 'from-orange-200 to-amber-100',
  italian: 'from-green-200 to-yellow-100',
  desserts: 'from-pink-200 to-purple-100',
  vegetarian: 'from-emerald-200 to-lime-100',
  comfort: 'from-amber-200 to-orange-100',
  quick: 'from-sky-200 to-blue-100',
}

function getGradient(tags: string[]): string {
  for (const tag of tags) {
    const key = Object.keys(TAG_GRADIENT_MAP).find((k) => tag.includes(k))
    if (key) return TAG_GRADIENT_MAP[key]
  }
  return 'from-stone-200 to-stone-100'
}

export function ChatRecipeCards({ recipes }: Props) {
  const { t } = useTranslation()
  const saveRecipeMutation = useSaveRecipe()

  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [savedTitles, setSavedTitles] = useState<Set<string>>(() => new Set())
  const [savedIds, setSavedIds] = useState<Map<string, number>>(() => new Map())
  const [addedToShopping, setAddedToShopping] = useState<Set<string>>(() => new Set())
  const [mealSheetRecipeIds, setMealSheetRecipeIds] = useState<number[] | null>(null)

  function toggleExpand(title: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(title)) {
        next.delete(title)
      } else {
        next.add(title)
      }
      return next
    })
  }

  async function handleSave(recipe: RecipeCard) {
    if (savedTitles.has(recipe.title)) return

    const req: SaveRecipeRequest = {
      recipe,
      source_mode: 'chat',
    }

    const saved = await saveRecipeMutation.mutateAsync(req)
    setSavedTitles((prev) => new Set(prev).add(recipe.title))
    setSavedIds((prev) => {
      const next = new Map(prev)
      next.set(recipe.title, saved.id)
      return next
    })
    return saved.id
  }

  async function handleAddToMeal(recipe: RecipeCard) {
    let recipeId = savedIds.get(recipe.title)
    if (!recipeId) {
      recipeId = await handleSave(recipe)
    }
    if (recipeId) {
      setMealSheetRecipeIds([recipeId])
    }
  }

  async function handleAddMissing(recipe: RecipeCard) {
    if (addedToShopping.has(recipe.title)) return

    const missingIngredients = recipe.ingredients.filter((ing) => !ing.have_in_stock)
    if (missingIngredients.length === 0) return

    const items = missingIngredients.map((ing) => ({
      item_name: ing.name,
      quantity: ing.quantity ?? undefined,
      unit: ing.unit ?? undefined,
      source: 'recipe' as const,
    }))

    try {
      await apiClient.post('/api/v1/shopping/bulk', { items })
      setAddedToShopping((prev) => new Set(prev).add(recipe.title))
      toast.success(t('recipes.addedToList'))
    } catch {
      toast.error(t('shopping.completeFailed'))
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2 mt-2">
        {recipes.map((recipe) => {
          const isExpanded = expanded.has(recipe.title)
          const isSaved = savedTitles.has(recipe.title)
          const isAddedToShopping = addedToShopping.has(recipe.title)

          return (
            <div
              key={recipe.title}
              className="w-full rounded-xl border border-border overflow-hidden"
            >
              {/* Clickable header area */}
              <button
                type="button"
                onClick={() => toggleExpand(recipe.title)}
                className="w-full text-left cursor-pointer"
              >
                <div
                  className={`h-14 bg-gradient-to-br ${getGradient(recipe.tags)} px-3 py-2 flex flex-col justify-end`}
                >
                  <p className="font-semibold text-sm text-stone-800 line-clamp-1">
                    {recipe.title}
                  </p>
                </div>
                <div className="px-3 py-2 bg-card">
                  <p className="text-xs text-stone-500 line-clamp-2 mb-1.5">
                    {recipe.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-stone-400">
                    {recipe.cook_time_min && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {recipe.cook_time_min} {t('recipes.minutes')}
                      </span>
                    )}
                    {recipe.servings && (
                      <span className="flex items-center gap-1">
                        <Users size={12} /> {recipe.servings}
                      </span>
                    )}
                    <span className="ml-auto flex items-center gap-1">
                      {recipe.tags.slice(0, 2).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 bg-stone-100 rounded text-[10px]"
                        >
                          {tag}
                        </span>
                      ))}
                      {isExpanded ? (
                        <ChevronUp size={14} className="text-stone-400 ml-1" />
                      ) : (
                        <ChevronDown size={14} className="text-stone-400 ml-1" />
                      )}
                    </span>
                  </div>
                  {!isExpanded && (
                    <p className="text-[10px] text-stone-300 mt-1">
                      {t('recipes.tapToExpand')}
                    </p>
                  )}
                </div>
              </button>

              {/* Expandable details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 bg-card border-t border-border">
                      {/* Ingredients */}
                      <p className="text-xs font-semibold text-stone-700 mt-2 mb-1">
                        {t('recipes.ingredients')}
                      </p>
                      <ul className="space-y-0.5">
                        {recipe.ingredients.map((ing) => (
                          <li
                            key={ing.name}
                            className="flex items-center gap-1.5 text-xs text-stone-600"
                          >
                            {ing.have_in_stock ? (
                              <CheckCircle2 size={13} className="text-green-500 shrink-0" />
                            ) : (
                              <XCircle size={13} className="text-red-400 shrink-0" />
                            )}
                            <span>
                              {ing.quantity != null && ing.unit
                                ? `${ing.quantity} ${ing.unit} `
                                : ''}
                              {ing.name}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* Instructions */}
                      <p className="text-xs font-semibold text-stone-700 mt-3 mb-1">
                        {t('recipes.instructions')}
                      </p>
                      <ol className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {recipe.instructions.map((step, idx) => (
                          <li key={idx} className="text-xs text-stone-600 flex gap-1.5">
                            <span className="text-stone-400 font-medium shrink-0">
                              {idx + 1}.
                            </span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          type="button"
                          onClick={() => void handleSave(recipe)}
                          disabled={isSaved || saveRecipeMutation.isPending}
                          className={`text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                            isSaved
                              ? 'bg-pink-50 text-pink-600'
                              : 'bg-muted hover:bg-muted/80'
                          }`}
                        >
                          <Heart size={13} fill={isSaved ? 'currentColor' : 'none'} />
                          {t('recipes.saveToCollection')}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleAddToMeal(recipe)}
                          disabled={saveRecipeMutation.isPending}
                          className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
                        >
                          <CalendarPlus size={13} />
                          {t('recipes.addToMeal')}
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleAddMissing(recipe)}
                          disabled={
                            isAddedToShopping ||
                            recipe.ingredients.every((ing) => ing.have_in_stock)
                          }
                          className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 transition-colors disabled:opacity-50"
                        >
                          <ShoppingCart size={13} />
                          {t('recipes.addMissingShort')}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

      {/* Add to meal sheet */}
      {mealSheetRecipeIds && (
        <AddToMealSheet
          recipeIds={mealSheetRecipeIds}
          open={true}
          onClose={() => setMealSheetRecipeIds(null)}
        />
      )}
    </>
  )
}
