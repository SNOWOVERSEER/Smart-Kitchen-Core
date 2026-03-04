import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Check, Clock, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSavedRecipes } from '@/features/recipes/hooks/useRecipes'
import { Input } from '@/components/ui/input'
import { MEAL_FORM_INPUT } from './mealFormStyles'

export interface RecipePickerProps {
  selectedIds: number[]
  onToggle: (id: number) => void
}

export function RecipePicker({ selectedIds, onToggle }: RecipePickerProps) {
  const { t } = useTranslation()
  const { data: recipes, isLoading } = useSavedRecipes()
  const [searchQuery, setSearchQuery] = useState('')

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredRecipes = useMemo(() => {
    if (!recipes) return []
    if (!normalizedQuery) return recipes
    return recipes.filter((r) => {
      const titleMatch = r.title.toLowerCase().includes(normalizedQuery)
      const descMatch = (r.description ?? '').toLowerCase().includes(normalizedQuery)
      const tagsMatch = r.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
      return titleMatch || descMatch || tagsMatch
    })
  }, [recipes, normalizedQuery])

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!recipes?.length) {
    return (
      <p className="text-sm text-muted-foreground text-center py-4">
        {t('recipes.noRecipes', 'No saved recipes')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('meals.searchRecipesPlaceholder', 'Search recipes...')}
          className={cn(MEAL_FORM_INPUT, 'h-10 pl-8 py-2.5')}
        />
      </div>

      {filteredRecipes.length === 0 && (
        <p className="text-xs text-stone-400 text-center py-2">
          {t('meals.noRecipesMatchSearch', 'No recipes match your search')}
        </p>
      )}

      <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto pr-1 pb-0">
        {filteredRecipes.map((r) => {
          const selected = selectedIds.includes(r.id)
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onToggle(r.id)}
              className={cn(
                'flex items-center gap-3 rounded-xl border p-2 text-left transition-all',
                selected
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-transparent bg-[#F5EFE6] hover:bg-[#f1e7db]',
              )}
            >
              {/* Thumbnail */}
              {r.image_url ? (
                <img
                  src={r.image_url}
                  alt={r.title}
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-stone-200 to-stone-300 shrink-0" />
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-stone-700 truncate block">
                  {r.title}
                </span>
                {r.cook_time_min != null && (
                  <span className="flex items-center gap-1 text-[11px] text-stone-400 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {r.cook_time_min} min
                  </span>
                )}
              </div>

              {/* Checkbox */}
              <div
                className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-all',
                  selected
                    ? 'border-primary bg-primary text-white'
                    : 'border-stone-300',
                )}
              >
                {selected && <Check className="h-3 w-3" />}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
