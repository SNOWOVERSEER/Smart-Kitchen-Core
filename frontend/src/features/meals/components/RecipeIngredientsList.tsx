import { Loader2, Check, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRecipe } from '@/features/recipes/hooks/useRecipes'
import { cn } from '@/lib/utils'

interface RecipeIngredientsListProps {
  recipeId: number
  compact?: boolean
}

export function RecipeIngredientsList({ recipeId, compact }: RecipeIngredientsListProps) {
  const { t } = useTranslation()
  const { data: recipe, isLoading } = useRecipe(recipeId)

  if (isLoading) {
    return (
      <div className="flex justify-center py-3">
        <Loader2 className="h-4 w-4 animate-spin text-stone-400" />
      </div>
    )
  }

  if (!recipe || recipe.ingredients.length === 0) {
    return (
      <p className="text-xs text-stone-400 py-2">
        {t('meals.noInstructions', 'No ingredients available')}
      </p>
    )
  }

  return (
    <div className={cn('flex flex-col gap-1', compact ? 'text-xs' : 'text-sm')}>
      {recipe.ingredients.map((ing, i) => (
        <div
          key={`${ing.name}-${i}`}
          className="flex items-center gap-2 py-1 px-1"
        >
          {/* Stock status icon */}
          {ing.have_in_stock ? (
            <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          )}

          {/* Ingredient name + quantity */}
          <span className={cn(
            'flex-1',
            ing.have_in_stock ? 'text-stone-600' : 'text-stone-800 font-medium',
          )}>
            {ing.quantity != null && `${ing.quantity}`}
            {ing.unit && ` ${ing.unit}`}
            {(ing.quantity != null || ing.unit) && ' '}
            {ing.name}
          </span>

          {/* Stock label */}
          <span className={cn(
            'shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
            ing.have_in_stock
              ? 'bg-emerald-50 text-emerald-600'
              : 'bg-amber-50 text-amber-600',
          )}>
            {ing.have_in_stock ? t('meals.inStock') : t('meals.missing')}
          </span>
        </div>
      ))}
    </div>
  )
}
