import { useState } from 'react'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { useTranslation } from 'react-i18next'
import { useSavedRecipes } from '@/features/recipes/hooks/useRecipes'
import { SavedRecipeCard } from './SavedRecipeCard'
import { RecipeDetailOverlay } from './RecipeDetailOverlay'
import type { SavedRecipe } from '@/shared/lib/api.types'

interface Props {
  open: boolean
  onClose: () => void
}

export function HeartCollectionPanel({ open, onClose }: Props) {
  const { t } = useTranslation()
  const { data: recipes = [], isLoading, isFetching, refetch } = useSavedRecipes()
  const [selectedRecipe, setSelectedRecipe] = useState<SavedRecipe | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  function handleCardClick(recipe: SavedRecipe) {
    setSelectedRecipe(recipe)
    setDetailOpen(true)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
        <SheetContent side="right" showCloseButton={false} className="sm:max-w-[420px] flex flex-col p-0">
          <SheetHeader className="px-5 pt-5 pb-4 border-b border-border shrink-0">
            <div className="flex items-center justify-between gap-2">
              <SheetTitle>{t('recipes.savedRecipesPanel')}</SheetTitle>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void refetch()}
                  disabled={isFetching}
                  className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  aria-label="Refresh saved recipes"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
                </button>
                <SheetClose
                  className="h-8 w-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center cursor-pointer"
                  aria-label="Close saved recipes"
                  title="Close"
                >
                  <ChevronRight className="w-4 h-4" />
                </SheetClose>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <span className="text-sm text-muted-foreground">{t('common.loading')}</span>
              </div>
            ) : recipes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <p className="text-sm font-medium text-foreground">{t('recipes.noSavedRecipes')}</p>
                <p className="text-xs text-muted-foreground">{t('recipes.noSavedRecipesSub')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {recipes.map(recipe => (
                  <SavedRecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    onClick={() => handleCardClick(recipe)}
                  />
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <RecipeDetailOverlay
        recipe={selectedRecipe}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        savedRecipeId={selectedRecipe?.id}
      />
    </>
  )
}
