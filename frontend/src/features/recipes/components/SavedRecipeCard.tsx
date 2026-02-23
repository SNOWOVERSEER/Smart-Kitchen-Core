import { Clock, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { SavedRecipe } from '@/shared/lib/api.types'

const TAG_GRADIENT_MAP: Record<string, string> = {
  asian: 'from-orange-100 to-amber-100',
  italian: 'from-green-100 to-yellow-100',
  desserts: 'from-pink-100 to-purple-100',
  vegetarian: 'from-green-100 to-emerald-100',
  vegan: 'from-teal-100 to-green-100',
  protein: 'from-red-100 to-orange-100',
  comfort: 'from-amber-100 to-yellow-100',
}

interface Props {
  recipe: SavedRecipe
  onClick: () => void
}

export function SavedRecipeCard({ recipe, onClick }: Props) {
  const { t } = useTranslation()
  const firstTag = recipe.tags[0]?.toLowerCase() ?? ''
  const gradientKey = Object.keys(TAG_GRADIENT_MAP).find(k => firstTag.includes(k))
  const gradientClass = gradientKey ? TAG_GRADIENT_MAP[gradientKey] : 'from-accent to-muted'

  const inStockCount = recipe.ingredients.filter(i => i.have_in_stock).length
  const totalCount = recipe.ingredients.length

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className="bg-card rounded-xl border border-border overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex flex-col"
    >
      {/* Image / gradient area */}
      <div className="h-28 overflow-hidden bg-muted shrink-0">
        {recipe.image_url ? (
          <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradientClass}`} />
        )}
      </div>

      {/* Content */}
      <div className="p-3 flex flex-col gap-1.5">
        <p className="font-semibold text-sm text-foreground leading-tight line-clamp-2">{recipe.title}</p>
        {(recipe.cook_time_min != null || recipe.servings != null) && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {recipe.cook_time_min != null && (
              <span className="flex items-center gap-0.5">
                <Clock className="w-3 h-3 shrink-0" />
                {t('recipes.cookTime', { min: recipe.cook_time_min })}
              </span>
            )}
            {recipe.servings != null && (
              <span className="flex items-center gap-0.5">
                <Users className="w-3 h-3 shrink-0" />
                {t('recipes.servings', { count: recipe.servings })}
              </span>
            )}
          </div>
        )}
        {totalCount > 0 && (
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${(inStockCount / totalCount) * 100}%` }}
            />
          </div>
        )}
        {recipe.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {recipe.tags.slice(0, 2).map(tag => (
              <span key={tag} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
