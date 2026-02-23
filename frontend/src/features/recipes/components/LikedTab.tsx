import { useState } from 'react'
import { BookOpen, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSavedRecipes } from '@/features/recipes/hooks/useRecipes'
import { SavedRecipeCard } from './SavedRecipeCard'
import { RecipeDetailSheet } from './RecipeDetailSheet'
import type { SavedRecipe } from '@/shared/lib/api.types'

export function LikedTab() {
  const { t } = useTranslation()
  const { data: recipes, isLoading } = useSavedRecipes()
  const [selectedRecipe, setSelectedRecipe] = useState<SavedRecipe | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!recipes || recipes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <BookOpen className="w-10 h-10 text-muted-foreground" />
        <p className="text-base font-semibold text-foreground">{t('recipes.likedEmpty')}</p>
        <p className="text-sm text-muted-foreground">{t('recipes.likedEmptySub')}</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {recipes.map((recipe) => (
          <SavedRecipeCard
            key={recipe.id}
            recipe={recipe}
            onClick={() => setSelectedRecipe(recipe)}
          />
        ))}
      </div>

      <RecipeDetailSheet
        recipe={selectedRecipe}
        open={selectedRecipe !== null}
        onClose={() => setSelectedRecipe(null)}
      />
    </>
  )
}
