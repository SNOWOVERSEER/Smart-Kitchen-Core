import { useEffect, useMemo, useState } from 'react'
import { ChevronRight, RefreshCw, Search } from 'lucide-react'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
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
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!open) setSearchQuery('')
  }, [open])

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const filteredRecipes = useMemo(() => {
    if (!normalizedQuery) return recipes
    return recipes.filter((recipe) => {
      const titleMatch = recipe.title.toLowerCase().includes(normalizedQuery)
      const descMatch = (recipe.description ?? '').toLowerCase().includes(normalizedQuery)
      const tagsMatch = recipe.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery))
      return titleMatch || descMatch || tagsMatch
    })
  }, [recipes, normalizedQuery])

  function handleCardClick(recipe: SavedRecipe) {
    setSelectedRecipe(recipe)
    setDetailOpen(true)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
        <SheetContent aria-describedby={undefined} side="right" showCloseButton={false} className="sm:max-w-[420px] flex flex-col p-0">
          <SheetHeader className="px-5 pt-5 pb-2 shrink-0">
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
            <div className="relative mt-2.5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('recipes.savedRecipesSearchPlaceholder')}
                className="h-9 pl-8 rounded-full bg-muted border-border/70"
              />
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <span className="text-sm text-muted-foreground">{t('common.loading')}</span>
              </div>
            ) : recipes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <p className="text-sm font-medium text-foreground">{t('recipes.noSavedRecipes')}</p>
                <p className="text-xs text-muted-foreground">{t('recipes.noSavedRecipesSub')}</p>
              </div>
            ) : filteredRecipes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
                <p className="text-sm font-medium text-foreground">{t('recipes.noSavedRecipesMatchSearch')}</p>
                <p className="text-xs text-muted-foreground">{t('recipes.savedRecipesSearchHint')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filteredRecipes.map(recipe => (
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
