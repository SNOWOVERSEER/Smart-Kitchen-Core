import { Clock, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SavedRecipe } from '@/shared/lib/api.types'

interface Props {
  recipe: SavedRecipe
  onClick: () => void
}

export function SavedRecipeCard({ recipe, onClick }: Props) {
  const { t } = useTranslation()

  const inStockCount = recipe.ingredients.filter((i) => i.have_in_stock).length
  const totalCount = recipe.ingredients.length
  const stockRatio = totalCount > 0 ? inStockCount / totalCount : 0
  const badgeClass =
    stockRatio >= 0.7
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-amber-100 text-amber-700'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() }
      }}
      className="bg-card rounded-xl border border-border p-4 cursor-pointer hover:shadow-md transition-shadow flex flex-col gap-2"
    >
      {/* Title */}
      <p className="font-semibold text-base text-foreground leading-tight">{recipe.title}</p>

      {/* Description */}
      {recipe.description && (
        <p className="text-sm text-muted-foreground line-clamp-2 leading-snug">
          {recipe.description}
        </p>
      )}

      {/* Meta row */}
      {(recipe.cook_time_min != null || recipe.servings != null) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {recipe.cook_time_min != null && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 shrink-0" />
              {t('recipes.cookTime', { min: recipe.cook_time_min })}
            </span>
          )}
          {recipe.servings != null && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3 shrink-0" />
              {t('recipes.servings', { count: recipe.servings })}
            </span>
          )}
        </div>
      )}

      {/* In-stock badge */}
      {totalCount > 0 && (
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badgeClass}`}>
            {inStockCount} / {totalCount} in stock
          </span>
        </div>
      )}

      {/* Tags */}
      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {recipe.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
