import { useState } from 'react'
import { motion } from 'framer-motion'
import { Clock, Users, Trash2 } from 'lucide-react'
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
  onDelete: () => void
  isDeleting?: boolean
}

export function SavedRecipeCard({ recipe, onClick, onDelete, isDeleting = false }: Props) {
  const { t } = useTranslation()
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const firstTag = recipe.tags[0]?.toLowerCase() ?? ''
  const gradientKey = Object.keys(TAG_GRADIENT_MAP).find(k => firstTag.includes(k))
  const gradientClass = gradientKey ? TAG_GRADIENT_MAP[gradientKey] : 'from-accent to-muted'

  const inStockCount = recipe.ingredients.filter(
    i => i.have_in_stock && (i.coverage_ratio === null || i.coverage_ratio > 1.1)
  ).length
  const partialCount = recipe.ingredients.filter(
    i => (i.have_in_stock && i.coverage_ratio != null && i.coverage_ratio <= 1.1) ||
         (!i.have_in_stock && i.coverage_ratio != null && i.coverage_ratio >= 0.75)
  ).length
  const totalCount = recipe.ingredients.length

  function closeDeleteConfirm() {
    if (isDeleting) return
    setIsDeleteConfirmOpen(false)
  }

  function handleCardClick() {
    if (isDeleteConfirmOpen) {
      closeDeleteConfirm()
      return
    }
    onClick()
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleCardClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCardClick()
        }
      }}
      className="relative bg-card rounded-xl border border-border overflow-hidden cursor-pointer hover:shadow-md transition-shadow flex flex-col"
    >
      {/* Image / gradient area */}
      <div className="relative h-28 overflow-hidden bg-muted shrink-0">
        {recipe.image_url ? (
          <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradientClass}`} />
        )}

        <div className="absolute top-2 right-2 z-10 h-8 w-24 overflow-visible">
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (isDeleting) return
              if (!isDeleteConfirmOpen) {
                setIsDeleteConfirmOpen(true)
                return
              }
              onDelete()
            }}
            disabled={isDeleting}
            initial={false}
            animate={{
              width: isDeleteConfirmOpen ? 92 : 32,
              backgroundColor: isDeleteConfirmOpen ? 'rgb(239 68 68)' : 'rgba(255,255,255,0.88)',
              borderColor: isDeleteConfirmOpen ? 'rgba(239,68,68,0.96)' : 'rgba(255,255,255,0.72)',
              color: isDeleteConfirmOpen ? 'rgb(255,255,255)' : 'rgb(120,113,108)',
              boxShadow: isDeleteConfirmOpen
                ? '0 14px 24px -16px rgba(239, 68, 68, 0.72)'
                : '0 4px 10px -8px rgba(0,0,0,0.22)',
            }}
            transition={{ type: 'spring', stiffness: 340, damping: 30, mass: 0.9 }}
            className="absolute inset-y-0 right-0 flex h-8 items-center justify-start overflow-hidden rounded-full border backdrop-blur-sm disabled:opacity-65"
            style={{ transformOrigin: 'right center' }}
            aria-label={t('recipes.deleteRecipe')}
          >
            <motion.span
              initial={false}
              animate={{
                scale: isDeleteConfirmOpen ? 0.96 : 1,
                x: isDeleteConfirmOpen ? 1 : 0,
              }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className="flex h-8 w-8 shrink-0 items-center justify-center"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </motion.span>

            <motion.span
              initial={false}
              animate={{
                opacity: isDeleteConfirmOpen ? 1 : 0,
                x: isDeleteConfirmOpen ? 0 : 8,
                filter: isDeleteConfirmOpen ? 'blur(0px)' : 'blur(2px)',
              }}
              transition={{
                duration: isDeleteConfirmOpen ? 0.18 : 0.12,
                ease: [0.22, 1, 0.36, 1],
                delay: isDeleteConfirmOpen ? 0.06 : 0,
              }}
              className="pr-3 text-[10.5px] font-semibold whitespace-nowrap"
            >
              {t('shopping.deleteItem')}
            </motion.span>
          </motion.button>
        </div>
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
          <div className="h-1 bg-muted rounded-full overflow-hidden flex">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${(inStockCount / totalCount) * 100}%` }}
            />
            {partialCount > 0 && (
              <div
                className="h-full bg-amber-400"
                style={{ width: `${(partialCount / totalCount) * 100}%` }}
              />
            )}
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
