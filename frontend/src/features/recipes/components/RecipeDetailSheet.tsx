import { CheckCircle2, XCircle, Clock, Users, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useDeleteRecipe } from '@/features/recipes/hooks/useRecipes'
import { useAddShoppingItemsBulk } from '@/features/shopping/hooks/useShoppingList'
import type { SavedRecipe, ShoppingItemCreate } from '@/shared/lib/api.types'

interface Props {
  recipe: SavedRecipe | null
  open: boolean
  onClose: () => void
}

export function RecipeDetailSheet({ recipe, open, onClose }: Props) {
  const { t } = useTranslation()
  const deleteRecipe = useDeleteRecipe()
  const addBulk = useAddShoppingItemsBulk()

  if (!recipe) return null

  const missingIngredients = recipe.ingredients.filter((i) => !i.have_in_stock)

  function handleAddMissing() {
    if (!recipe) return
    const items: ShoppingItemCreate[] = missingIngredients.map((ingredient) => ({
      item_name: ingredient.name,
      quantity: ingredient.quantity ?? undefined,
      unit: ingredient.unit ?? undefined,
      source: 'recipe' as const,
      source_recipe_id: recipe.id,
      source_recipe_title: recipe.title,
    }))
    addBulk.mutate(items)
  }

  function handleDelete() {
    if (!recipe) return
    deleteRecipe.mutate(recipe.id, {
      onSuccess: () => onClose(),
    })
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-xl font-bold leading-tight">{recipe.title}</SheetTitle>
          {recipe.description && (
            <SheetDescription className="text-sm text-muted-foreground">
              {recipe.description}
            </SheetDescription>
          )}
        </SheetHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
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
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-foreground uppercase tracking-widest">
              {t('recipes.ingredients')}
            </p>
            <ul className="flex flex-col gap-2">
              {recipe.ingredients.map((ingredient, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm">
                  {ingredient.have_in_stock ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                  )}
                  <span className="text-foreground">{ingredient.name}</span>
                  {(ingredient.quantity != null || ingredient.unit != null) && (
                    <span className="text-muted-foreground ml-auto whitespace-nowrap">
                      {ingredient.quantity != null ? ingredient.quantity : ''}
                      {ingredient.unit ? ` ${ingredient.unit}` : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Instructions */}
          {recipe.instructions.length > 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest">
                {t('recipes.instructions')}
              </p>
              <ol className="flex flex-col gap-3">
                {recipe.instructions.map((step, idx) => (
                  <li key={idx} className="flex gap-3 text-sm">
                    <span className="shrink-0 font-semibold text-muted-foreground w-5">
                      {idx + 1}.
                    </span>
                    <span className="text-foreground leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-border bg-card shrink-0 flex flex-col gap-2">
          {missingIngredients.length > 0 && (
            <Button
              onClick={handleAddMissing}
              disabled={addBulk.isPending}
              className="w-full h-10"
            >
              {t('recipes.addMissingToList')}
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteRecipe.isPending}
            className="w-full h-10 flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            {t('recipes.deleteRecipe')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
