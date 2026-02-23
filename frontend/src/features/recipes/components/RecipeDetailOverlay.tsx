import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Clock, Users, CheckCircle2, XCircle, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useDeleteRecipe } from '@/features/recipes/hooks/useRecipes'
import { AddFromRecipeSheet } from './AddFromRecipeSheet'
import type { RecipeCard, SavedRecipe } from '@/shared/lib/api.types'

interface Props {
  recipe: RecipeCard | SavedRecipe | null
  open: boolean
  onClose: () => void
  onSave?: () => void
  onSkip?: () => void
  savedRecipeId?: number
}

const TAG_GRADIENT_MAP: Record<string, string> = {
  asian: 'from-orange-100 to-amber-100',
  italian: 'from-green-100 to-yellow-100',
  desserts: 'from-pink-100 to-purple-100',
  vegetarian: 'from-green-100 to-emerald-100',
  vegan: 'from-teal-100 to-green-100',
  protein: 'from-red-100 to-orange-100',
  comfort: 'from-amber-100 to-yellow-100',
}

export function RecipeDetailOverlay({ recipe, open, onClose, onSave, onSkip, savedRecipeId }: Props) {
  const { t } = useTranslation()
  const isSaved = savedRecipeId != null
  const missingIngredients = recipe ? recipe.ingredients.filter(i => !i.have_in_stock) : []
  const [addSheetOpen, setAddSheetOpen] = useState(false)
  const deleteRecipe = useDeleteRecipe()

  const firstTag = recipe?.tags[0]?.toLowerCase() ?? ''
  const gradientKey = Object.keys(TAG_GRADIENT_MAP).find(k => firstTag.includes(k))
  const gradientClass = gradientKey ? TAG_GRADIENT_MAP[gradientKey] : 'from-accent to-muted'

  return (
    <>
      <AnimatePresence>
        {open && recipe && (
          <>
            {/* Backdrop */}
            <motion.div
              className="fixed inset-0 z-40 bg-black/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
            />
            {/* Card — layoutId matches RecipeCard3D */}
            <motion.div
              layoutId={`recipe-card-${recipe.title}`}
              className="fixed inset-x-3 bottom-3 top-12 z-50 bg-card rounded-2xl overflow-hidden flex flex-col lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2 lg:w-[480px]"
              initial={{ rotateY: -12 }}
              animate={{ rotateY: 0 }}
              exit={{ rotateY: -12, opacity: 0 }}
              style={{ transformPerspective: 1200 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/30 text-white hover:bg-black/50 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Hero image / gradient */}
              <div className="relative h-52 shrink-0 overflow-hidden">
                {'image_url' in recipe && recipe.image_url ? (
                  <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradientClass}`} />
                )}
                {/* Title overlay at bottom of hero */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 py-3">
                  <h2 className="text-xl font-bold text-white leading-tight">{recipe.title}</h2>
                </div>
              </div>

              {/* Scrollable body */}
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5">
                {/* Meta */}
                {(recipe.cook_time_min != null || recipe.servings != null) && (
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {recipe.cook_time_min != null && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 shrink-0" />
                        {t('recipes.cookTime', { min: recipe.cook_time_min })}
                      </span>
                    )}
                    {recipe.servings != null && (
                      <span className="flex items-center gap-1.5">
                        <Users className="w-4 h-4 shrink-0" />
                        {t('recipes.servings', { count: recipe.servings })}
                      </span>
                    )}
                  </div>
                )}

                {/* Ingredients */}
                <div>
                  <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-2.5">
                    {t('recipes.ingredients')}
                  </p>
                  <ul className="flex flex-col gap-2">
                    {recipe.ingredients.map((ing) => (
                      <li key={ing.name} className="flex items-center gap-2 text-sm">
                        {ing.have_in_stock ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                        )}
                        <span className="text-foreground">{ing.name}</span>
                        {(ing.quantity != null || ing.unit != null) && (
                          <span className="text-muted-foreground ml-auto whitespace-nowrap text-xs">
                            {ing.quantity != null ? ing.quantity : ''}{ing.unit ? ` ${ing.unit}` : ''}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Instructions */}
                {recipe.instructions.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-foreground uppercase tracking-widest mb-2.5">
                      {t('recipes.instructions')}
                    </p>
                    <ol className="flex flex-col gap-3">
                      {recipe.instructions.map((step, idx) => (
                        <li key={idx} className="flex gap-3 text-sm">
                          <span className="shrink-0 font-semibold text-muted-foreground w-5">{idx + 1}.</span>
                          <span className="text-foreground leading-relaxed">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>

              {/* Footer actions */}
              <div className="px-5 py-4 border-t border-border bg-card shrink-0 flex flex-col gap-2">
                {isSaved ? (
                  <>
                    {missingIngredients.length > 0 && (
                      <Button onClick={() => setAddSheetOpen(true)} className="w-full h-10">
                        {t('recipes.addMissingToList')}
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (savedRecipeId) deleteRecipe.mutate(savedRecipeId, { onSuccess: onClose })
                      }}
                      disabled={deleteRecipe.isPending}
                      className="w-full h-10 flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('recipes.deleteRecipe')}
                    </Button>
                  </>
                ) : (
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={onSkip} className="flex-1 h-10">
                      {t('recipes.skip')}
                    </Button>
                    <Button onClick={onSave} className="flex-1 h-10">
                      {t('recipes.save')}
                    </Button>
                  </div>
                )}
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
