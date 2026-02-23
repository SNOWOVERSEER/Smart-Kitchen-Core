import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import type { PanInfo } from 'framer-motion'
import { Clock, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RecipeCard } from '@/shared/lib/api.types'

interface Props {
  recipe: RecipeCard
  isTop: boolean
  stackIndex: number
  onLike: () => void
  onSkip: () => void
  disabled?: boolean
}

const SWIPE_THRESHOLD = 100
const MAX_VISIBLE_INGREDIENTS = 8

export function RecipeSwipeCard({ recipe, isTop, stackIndex, onLike, onSkip, disabled = false }: Props) {
  const { t } = useTranslation()

  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-15, 15])
  const skipOpacity = useTransform(x, [-120, 0], [1, 0])
  const saveOpacity = useTransform(x, [0, 120], [0, 1])

  function handleDragEnd(_: PointerEvent, info: PanInfo) {
    if (info.offset.x > SWIPE_THRESHOLD) {
      void animate(x, 600, { duration: 0.3 }).then(onLike)
    } else if (info.offset.x < -SWIPE_THRESHOLD) {
      void animate(x, -600, { duration: 0.3 }).then(onSkip)
    } else {
      void animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
    }
  }

  const inStockCount = recipe.ingredients.filter((i) => i.have_in_stock).length
  const totalCount = recipe.ingredients.length
  const visibleIngredients = recipe.ingredients.slice(0, MAX_VISIBLE_INGREDIENTS)
  const extraCount = Math.max(0, totalCount - MAX_VISIBLE_INGREDIENTS)

  const stackStyles: Record<number, string> = {
    0: 'scale-100 z-30',
    1: 'scale-[0.95] z-20 translate-y-3',
    2: 'scale-[0.90] z-10 translate-y-6',
  }
  const stackClass = stackStyles[stackIndex] ?? 'scale-[0.90] z-10 translate-y-6'

  return (
    <motion.div
      className={`absolute inset-0 ${stackClass} bg-white rounded-2xl shadow-lg p-6 max-w-sm mx-auto cursor-grab active:cursor-grabbing select-none`}
      style={{
        x: isTop ? x : undefined,
        rotate: isTop ? rotate : undefined,
      }}
      drag={isTop && !disabled ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={isTop ? handleDragEnd : undefined}
    >
      {/* SAVE overlay — top-right, fades in on right drag */}
      {isTop && (
        <motion.div
          className="absolute top-6 right-6 text-green-600 font-bold text-xl tracking-widest rotate-[-15deg] border-2 border-green-600 px-2 py-0.5 rounded pointer-events-none"
          style={{ opacity: saveOpacity }}
        >
          SAVE
        </motion.div>
      )}

      {/* SKIP overlay — top-left, fades in on left drag */}
      {isTop && (
        <motion.div
          className="absolute top-6 left-6 text-red-500 font-bold text-xl tracking-widest rotate-[15deg] border-2 border-red-500 px-2 py-0.5 rounded pointer-events-none"
          style={{ opacity: skipOpacity }}
        >
          SKIP
        </motion.div>
      )}

      {/* Header */}
      <div className="mb-3">
        <h3 className="font-semibold text-lg text-foreground leading-tight">{recipe.title}</h3>
        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{recipe.description}</p>
      </div>

      {/* Meta row */}
      {(recipe.cook_time_min != null || recipe.servings != null) && (
        <div className="flex items-center gap-4 mb-3 text-sm text-muted-foreground">
          {recipe.cook_time_min != null && (
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {t('recipes.cookTime', { min: recipe.cook_time_min })}
            </span>
          )}
          {recipe.servings != null && (
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 shrink-0" />
              {t('recipes.servings', { count: recipe.servings })}
            </span>
          )}
        </div>
      )}

      {/* In-stock ratio */}
      <div className="mb-3">
        <span className="text-xs font-medium text-muted-foreground">
          {inStockCount} / {totalCount} {t('recipes.inStock').toLowerCase()}
        </span>
        <div className="mt-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all"
            style={{ width: totalCount > 0 ? `${(inStockCount / totalCount) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Ingredient chips */}
      <div className="flex flex-wrap gap-1.5">
        {visibleIngredients.map((ingredient) => (
          <span
            key={ingredient.name}
            className={`text-xs px-2 py-0.5 rounded-full border ${
              ingredient.have_in_stock
                ? 'border-green-500 text-green-700 bg-green-50'
                : 'border-border text-muted-foreground bg-muted/30'
            }`}
          >
            {ingredient.name}
          </span>
        ))}
        {extraCount > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full border border-border text-muted-foreground bg-muted/30">
            +{extraCount} more
          </span>
        )}
      </div>
    </motion.div>
  )
}
