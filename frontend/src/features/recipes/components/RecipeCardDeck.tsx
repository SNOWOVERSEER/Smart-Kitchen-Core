import { useRef, useState } from 'react'
import { LayoutGroup, motion } from 'framer-motion'
import { X, Heart, LayoutGrid, Layers } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { useSaveRecipe } from '@/features/recipes/hooks/useRecipes'
import { RecipeCard3D } from './RecipeCard3D'
import { RecipeDetailOverlay } from './RecipeDetailOverlay'
import type { RecipeCard } from '@/shared/lib/api.types'

interface Props {
  recipes: RecipeCard[]
  sourceMode: string
  sourcePrompt?: string
  onGenerateMore: () => void
  heartRef: React.RefObject<HTMLButtonElement | null>
  onHeartPulse: () => void
}

export function RecipeCardDeck({
  recipes,
  sourceMode,
  sourcePrompt,
  onGenerateMore,
  heartRef,
  onHeartPulse,
}: Props) {
  const { t } = useTranslation()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [spreadMode, setSpreadMode] = useState(false)
  const [detailRecipe, setDetailRecipe] = useState<RecipeCard | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [flyState, setFlyState] = useState<{ from: DOMRect; to: DOMRect } | null>(null)
  const topCardRef = useRef<HTMLDivElement | null>(null)
  const saveRecipe = useSaveRecipe()

  function handleLike(recipe: RecipeCard) {
    const from = topCardRef.current?.getBoundingClientRect()
    const to = heartRef.current?.getBoundingClientRect()
    if (from && to) setFlyState({ from, to })
    setCurrentIndex(p => p + 1)
    saveRecipe.mutate(
      {
        recipe,
        source_mode: sourceMode,
        source_prompt: sourcePrompt,
        image_prompt: recipe.image_prompt ?? undefined,
      },
      { onSuccess: () => onHeartPulse() }
    )
  }

  function handleSkip() {
    setCurrentIndex(p => p + 1)
  }

  if (currentIndex >= recipes.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <p className="text-sm text-muted-foreground">{t('recipes.noMoreRecipes')}</p>
        <Button variant="outline" onClick={onGenerateMore}>{t('recipes.regenerate')}</Button>
      </div>
    )
  }

  const visibleRecipes = recipes.slice(currentIndex, currentIndex + 4)
  const visibleCount = visibleRecipes.length

  return (
    <div className="flex flex-col gap-4">
      <LayoutGroup>
        {/* Card area */}
        {spreadMode ? (
          <div className="grid grid-cols-2 gap-3">
            {recipes.slice(currentIndex).map((recipe) => (
              <motion.div key={recipe.title} layout>
                <RecipeCard3D
                  recipe={recipe}
                  isTop={false}
                  stackIndex={0}
                  spreadMode={true}
                  onLike={() => {
                    setCurrentIndex(p => p + 1)
                    saveRecipe.mutate(
                      { recipe, source_mode: sourceMode, source_prompt: sourcePrompt, image_prompt: recipe.image_prompt ?? undefined },
                      { onSuccess: () => onHeartPulse() }
                    )
                  }}
                  onSkip={() => setCurrentIndex(p => p + 1)}
                  onTap={() => { setDetailRecipe(recipe); setIsDetailOpen(true) }}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="relative w-full" style={{ height: 440 }}>
            {visibleRecipes.reverse().map((recipe, revIdx) => {
              const stackIndex = (Math.min(visibleCount, 4) - 1 - revIdx) as 0 | 1 | 2 | 3
              const isTop = stackIndex === 0
              // Don't render the card that's open in the detail overlay (prevents layoutId conflict)
              if (isDetailOpen && detailRecipe?.title === recipe.title) return null
              return (
                <RecipeCard3D
                  key={recipe.title}
                  recipe={recipe}
                  isTop={isTop}
                  stackIndex={stackIndex}
                  cardRef={isTop ? topCardRef : undefined}
                  onLike={() => handleLike(recipe)}
                  onSkip={handleSkip}
                  onTap={() => { if (isTop) { setDetailRecipe(recipe); setIsDetailOpen(true) } }}
                  disabled={isTop && saveRecipe.isPending}
                />
              )
            })}
          </div>
        )}
      </LayoutGroup>

      {/* Action buttons row */}
      {!spreadMode && (
        <div className="flex items-center justify-center gap-6 pt-2">
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-full border-2"
            onClick={handleSkip}
            aria-label={t('recipes.skip')}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={() => setSpreadMode(v => !v)}
            aria-label={spreadMode ? t('recipes.stackedView') : t('recipes.spreadView')}
          >
            {spreadMode ? <Layers className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-11 w-11 rounded-full border-2"
            onClick={() => handleLike(recipes[currentIndex])}
            disabled={saveRecipe.isPending}
            aria-label={t('recipes.save')}
          >
            <Heart className="w-5 h-5 text-rose-500" />
          </Button>
        </div>
      )}
      {spreadMode && (
        <div className="flex items-center justify-center pt-1">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setSpreadMode(false)}
          >
            <Layers className="w-4 h-4" />
            {t('recipes.stackedView')}
          </Button>
        </div>
      )}

      {/* Flying element animation */}
      {flyState && (
        <motion.div
          className="fixed z-[100] rounded-xl bg-card border border-border shadow-xl pointer-events-none"
          initial={{
            left: flyState.from.left,
            top: flyState.from.top,
            width: flyState.from.width,
            height: flyState.from.height,
            opacity: 1,
            position: 'fixed',
          }}
          animate={{
            left: flyState.to.x,
            top: flyState.to.y,
            width: 20,
            height: 20,
            opacity: 0,
            scale: 0,
          }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          onAnimationComplete={() => setFlyState(null)}
        />
      )}

      {/* Detail overlay */}
      <RecipeDetailOverlay
        recipe={detailRecipe}
        open={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onSave={() => {
          if (detailRecipe) handleLike(detailRecipe)
          setIsDetailOpen(false)
        }}
        onSkip={() => {
          setCurrentIndex(p => p + 1)
          setIsDetailOpen(false)
        }}
      />
    </div>
  )
}
