import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Clock, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RecipeCard, SavedRecipe } from '@/shared/lib/api.types'

interface Props {
  recipe: RecipeCard | SavedRecipe
  isTop: boolean
  stackIndex: 0 | 1 | 2 | 3
  spreadMode?: boolean
  onLike: () => void
  onSkip: () => void
  onTap: () => void
  disabled?: boolean
  cardRef?: React.RefObject<HTMLDivElement | null>
}

const STACK = [
  { scale: 1,    y: 0,  opacity: 1,    zIndex: 30 },
  { scale: 0.95, y: 12, opacity: 0.97, zIndex: 20 },
  { scale: 0.90, y: 24, opacity: 0.94, zIndex: 10 },
  { scale: 0.85, y: 36, opacity: 0.9,  zIndex: 5  },
]

const TAG_GRADIENT_MAP: Record<string, string> = {
  asian: 'from-orange-100 to-amber-100',
  italian: 'from-green-100 to-yellow-100',
  desserts: 'from-pink-100 to-purple-100',
  vegetarian: 'from-green-100 to-emerald-100',
  vegan: 'from-teal-100 to-green-100',
  protein: 'from-red-100 to-orange-100',
  comfort: 'from-amber-100 to-yellow-100',
}

export function RecipeCard3D({
  recipe,
  isTop,
  stackIndex,
  spreadMode = false,
  onLike,
  onSkip,
  onTap,
  disabled = false,
  cardRef,
}: Props) {
  const { t } = useTranslation()

  const firstTag = recipe.tags[0]?.toLowerCase() ?? ''
  const gradientKey = Object.keys(TAG_GRADIENT_MAP).find(k => firstTag.includes(k))
  const gradientClass = gradientKey ? TAG_GRADIENT_MAP[gradientKey] : 'from-accent to-muted'

  const inStockCount = recipe.ingredients.filter(i => i.have_in_stock).length
  const totalCount = recipe.ingredients.length

  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-15, 15])
  const skipOpacity = useTransform(x, [-120, 0], [1, 0])
  const saveOpacity = useTransform(x, [0, 120], [0, 1])

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x > 100) void animate(x, 600, { duration: 0.3 }).then(onLike)
    else if (info.offset.x < -100) void animate(x, -600, { duration: 0.3 }).then(onSkip)
    else void animate(x, 0, { type: 'spring', stiffness: 400, damping: 30 })
  }

  return (
    <motion.div
      layoutId={`recipe-card-${recipe.title}`}
      ref={cardRef}
      className={`bg-card rounded-2xl shadow-lg overflow-hidden select-none ${
        isTop || spreadMode ? 'cursor-pointer' : 'cursor-default'
      } ${!spreadMode ? 'absolute inset-0' : 'relative w-full'}`}
      style={{
        x: isTop && !spreadMode ? x : undefined,
        rotate: isTop && !spreadMode ? rotate : undefined,
        zIndex: !spreadMode ? STACK[stackIndex].zIndex : undefined,
      }}
      animate={
        !spreadMode
          ? { scale: STACK[stackIndex].scale, y: STACK[stackIndex].y, opacity: STACK[stackIndex].opacity }
          : { scale: 1, y: 0, opacity: 1 }
      }
      drag={isTop && !disabled && !spreadMode ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={isTop && !spreadMode ? handleDragEnd : undefined}
      onClick={isTop || spreadMode ? onTap : undefined}
    >
      {/* Image area */}
      <div className="relative min-h-[160px] h-[45%] overflow-hidden">
        {'image_url' in recipe && recipe.image_url ? (
          <img src={recipe.image_url} alt={recipe.title} className="w-full h-full object-cover" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradientClass}`} />
        )}
        {/* Tag pills bottom-left */}
        {recipe.tags.length > 0 && (
          <div className="absolute bottom-2 left-2 flex gap-1 flex-wrap">
            {recipe.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded-full bg-black/40 text-white backdrop-blur-sm">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* SAVE/SKIP overlays (top card only) */}
      {isTop && !spreadMode && (
        <>
          <motion.div
            className="absolute top-4 right-4 z-10 text-emerald-600 font-bold text-lg tracking-widest rotate-[-12deg] border-2 border-emerald-600 px-2 py-0.5 rounded pointer-events-none"
            style={{ opacity: saveOpacity }}
          >
            SAVE
          </motion.div>
          <motion.div
            className="absolute top-4 left-4 z-10 text-red-500 font-bold text-lg tracking-widest rotate-[12deg] border-2 border-red-500 px-2 py-0.5 rounded pointer-events-none"
            style={{ opacity: skipOpacity }}
          >
            SKIP
          </motion.div>
        </>
      )}

      {/* Card body */}
      <div className="p-4 flex flex-col gap-2.5">
        <h3 className="font-semibold text-base text-foreground leading-tight line-clamp-2">
          {recipe.title}
        </h3>

        {/* Meta row */}
        {(recipe.cook_time_min != null || recipe.servings != null) && (
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {recipe.cook_time_min != null && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 shrink-0" />
                {t('recipes.cookTime', { min: recipe.cook_time_min })}
              </span>
            )}
            {recipe.servings != null && (
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3 shrink-0" />
                {t('recipes.servings', { count: recipe.servings })}
              </span>
            )}
          </div>
        )}

        {/* In-stock ratio bar */}
        {recipe.ingredients.length > 0 && (
          <div>
            <span className="text-[11px] text-muted-foreground">
              {inStockCount}/{totalCount} {t('recipes.inStock').toLowerCase()}
            </span>
            <div className="mt-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${(inStockCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Ingredient chips (max 6 visible) */}
        <div className="flex flex-wrap gap-1">
          {recipe.ingredients.slice(0, 6).map(ing => (
            <span
              key={ing.name}
              className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                ing.have_in_stock
                  ? 'border-emerald-400 text-emerald-700 bg-emerald-50'
                  : 'border-border text-muted-foreground bg-muted/30'
              }`}
            >
              {ing.name}
            </span>
          ))}
          {recipe.ingredients.length > 6 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-border text-muted-foreground bg-muted/30">
              +{recipe.ingredients.length - 6}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
