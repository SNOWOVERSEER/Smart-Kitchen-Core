import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { RecipeSwipeCard } from './RecipeSwipeCard'
import { useSaveRecipe } from '@/features/recipes/hooks/useRecipes'
import type { RecipeCard } from '@/shared/lib/api.types'

interface Props {
  recipes: RecipeCard[]
  sourceMode: string
  sourcePrompt?: string
  onGenerateMore: () => void
}

export function RecipeSwipeSession({ recipes, sourceMode, sourcePrompt, onGenerateMore }: Props) {
  const { t } = useTranslation()
  const [currentIndex, setCurrentIndex] = useState(0)
  const saveRecipe = useSaveRecipe()

  function handleLike() {
    const recipe = recipes[currentIndex]
    if (recipe) {
      saveRecipe.mutate({
        recipe,
        source_mode: sourceMode,
        source_prompt: sourcePrompt,
      })
    }
    setCurrentIndex((prev) => prev + 1)
  }

  function handleSkip() {
    setCurrentIndex((prev) => prev + 1)
  }

  // Show "no more recipes" state
  if (currentIndex >= recipes.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-sm text-muted-foreground">{t('recipes.noMoreRecipes')}</p>
        <Button variant="outline" onClick={onGenerateMore}>
          {t('recipes.regenerate')}
        </Button>
      </div>
    )
  }

  // Render up to 3 visible cards in stacked order (rendered back-to-front so top card is on top)
  const visibleCards = [
    recipes[currentIndex + 2],
    recipes[currentIndex + 1],
    recipes[currentIndex],
  ].filter(Boolean) as RecipeCard[]

  // The stack indices for display: the last element in visibleCards array is the top card (index 0)
  // We render back-to-front: furthest = stackIndex 2, middle = stackIndex 1, top = stackIndex 0
  const stackAssignments = visibleCards.length === 3
    ? [2, 1, 0]
    : visibleCards.length === 2
    ? [1, 0]
    : [0]

  return (
    <div className="relative w-full max-w-sm mx-auto" style={{ height: 420 }}>
      {visibleCards.map((recipe, displayIdx) => {
        const stackIndex = stackAssignments[displayIdx] ?? 0
        const isTop = stackIndex === 0
        return (
          <RecipeSwipeCard
            key={`${currentIndex}-${stackIndex}`}
            recipe={recipe}
            isTop={isTop}
            stackIndex={stackIndex}
            onLike={handleLike}
            onSkip={handleSkip}
          />
        )
      })}
    </div>
  )
}
