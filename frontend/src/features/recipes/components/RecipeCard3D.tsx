import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { Clock, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { RecipeCard, SavedRecipe } from '@/shared/lib/api.types'

interface Props {
  recipe: RecipeCard | SavedRecipe
  displayMode: 'stack' | 'fan' | 'grid'
  isTop: boolean
  stackIndex: 0 | 1 | 2 | 3
  cardIndex?: number
  fanOffset?: number
  isFanCenter?: boolean
  isFanHighlighted?: boolean
  onLike: () => void
  onSkip: () => void
  onTap: () => void
  disabled?: boolean
  cardRef?: React.RefObject<HTMLDivElement | null>
}

const TAG_GRADIENT_MAP: Record<string, string> = {
  asian: 'from-orange-200 to-amber-100',
  italian: 'from-green-200 to-yellow-100',
  desserts: 'from-pink-200 to-purple-100',
  vegetarian: 'from-green-200 to-emerald-100',
  vegan: 'from-teal-200 to-green-100',
  protein: 'from-red-200 to-orange-100',
  comfort: 'from-amber-200 to-orange-100',
}

export function RecipeCard3D({
  recipe,
  displayMode,
  isTop,
  stackIndex,
  cardIndex,
  fanOffset,
  isFanCenter,
  isFanHighlighted,
  onLike,
  onSkip,
  onTap,
  disabled = false,
  cardRef,
}: Props) {
  const { t } = useTranslation()

  const firstTag = recipe.tags[0]?.toLowerCase() ?? ''
  const gradientKey = Object.keys(TAG_GRADIENT_MAP).find(k => firstTag.includes(k))
  const gradientClass = gradientKey ? TAG_GRADIENT_MAP[gradientKey] : 'from-amber-100 to-stone-100'

  const inStockCount = recipe.ingredients.filter(i => i.have_in_stock).length
  const totalCount = recipe.ingredients.length

  // Declared unconditionally (React hooks rules). Only wired to DOM in stack mode.
  const dragX = useMotionValue(0)
  const dragRotate = useTransform(dragX, [-200, 200], [-15, 15])
  const skipOpacity = useTransform(dragX, [-120, 0], [1, 0])
  const saveOpacity = useTransform(dragX, [0, 120], [0, 1])

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x > 100) void animate(dragX, 600, { duration: 0.3 }).then(onLike)
    else if (info.offset.x < -100) void animate(dragX, -600, { duration: 0.3 }).then(onSkip)
    else void animate(dragX, 0, { type: 'spring', stiffness: 400, damping: 30 })
  }

  // Shared card body content across all modes
  const cardBody = (
    <>
      {/* Image area — 60% */}
      <div className="relative overflow-hidden" style={{ flex: '0 0 58%' }}>
        {'image_url' in recipe && recipe.image_url ? (
          <img
            src={recipe.image_url}
            alt={recipe.title}
            className="w-full h-full object-cover pointer-events-none"
          />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${gradientClass}`} />
        )}

        {/* Gradient for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

        {/* Tag pills — top-left */}
        {recipe.tags.length > 0 && (
          <div className="absolute top-3 [@media(max-width:380px)]:top-2.5 left-3 [@media(max-width:380px)]:left-2.5 flex gap-1.5 [@media(max-width:380px)]:gap-1 flex-wrap">
            {recipe.tags.slice(0, 2).map(tag => (
              <span
                key={tag}
                className="px-2 [@media(max-width:380px)]:px-1.5 py-0.5 bg-white/20 backdrop-blur-md rounded-full text-[10px] [@media(max-width:380px)]:text-[9px] font-medium text-white"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Title overlay — bottom of image */}
        <div className="absolute bottom-0 left-0 right-0 px-4 [@media(max-width:380px)]:px-3 pb-3 [@media(max-width:380px)]:pb-2.5 pt-10 [@media(max-width:380px)]:pt-8">
          <h3 className="font-display text-[clamp(1.1rem,4.3vw,1.45rem)] font-semibold text-white leading-tight [@media(max-width:380px)]:leading-[1.12] line-clamp-2">
            {recipe.title}
          </h3>
        </div>
      </div>

      {/* Card body — 40% */}
      <div className="flex-1 p-4 [@media(max-width:380px)]:p-3 flex flex-col justify-between bg-white min-h-0">
        {/* Meta row */}
        <div className="flex items-center justify-between text-xs [@media(max-width:380px)]:text-[11px] text-stone-500 font-medium">
          {recipe.cook_time_min != null ? (
            <span className="flex items-center gap-1 [@media(max-width:380px)]:gap-0.5 whitespace-nowrap">
              <Clock className="w-3.5 h-3.5 [@media(max-width:380px)]:w-3 [@media(max-width:380px)]:h-3 shrink-0" />
              {t('recipes.cookTime', { min: recipe.cook_time_min })}
            </span>
          ) : <span />}
          {recipe.servings != null && (
            <span className="flex items-center gap-1 [@media(max-width:380px)]:gap-0.5 whitespace-nowrap">
              <Users className="w-3.5 h-3.5 [@media(max-width:380px)]:w-3 [@media(max-width:380px)]:h-3 shrink-0" />
              {t('recipes.servings', { count: recipe.servings })}
            </span>
          )}
        </div>

        {/* In-stock ratio bar */}
        {totalCount > 0 && (
          <div className="flex flex-col gap-1 [@media(max-width:380px)]:gap-0.5">
            <div className="flex justify-between text-[10px] [@media(max-width:380px)]:text-[9px] text-stone-400">
              <span>{inStockCount}/{totalCount} {t('recipes.inStock').toLowerCase()}</span>
              <span>{Math.round((inStockCount / totalCount) * 100)}%</span>
            </div>
            <div className="h-1.5 [@media(max-width:380px)]:h-1.25 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${(inStockCount / totalCount) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Tags footer */}
        <div className="border-t border-stone-100 pt-2 [@media(max-width:380px)]:pt-1.5 text-[10px] [@media(max-width:380px)]:text-[9px] text-stone-400 truncate">
          {recipe.tags.slice(0, 3).join(' · ')}
        </div>
      </div>
    </>
  )

  // --- Stack mode ---
  if (displayMode === 'stack') {
    const si = stackIndex
    const stackYVal = si * 14
    const stackXVal = si * (si % 2 === 0 ? 3 : -3)
    const stackRotateVal = si * (si % 2 === 0 ? 2 : -2)
    const stackScaleVal = 1 - si * 0.04

    return (
      <motion.div
        layoutId={`recipe-card-${recipe.title}`}
        ref={cardRef}
        className={`select-none rounded-3xl bg-white shadow-xl border border-stone-100 overflow-hidden flex flex-col absolute inset-0 ${
          isTop ? 'cursor-pointer' : 'cursor-default'
        }`}
        style={{
          x: isTop ? dragX : undefined,
          rotate: isTop ? dragRotate : undefined,
          zIndex: 4 - si,
          transformOrigin: 'bottom center',
        }}
        initial={{ opacity: 0, scale: 0.8, y: 30 }}
        animate={{
          scale: stackScaleVal,
          y: stackYVal,
          x: isTop ? 0 : stackXVal,
          rotate: isTop ? 0 : stackRotateVal,
          opacity: 1,
        }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: si * 0.08 }}
        drag={isTop && !disabled ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        onDragEnd={isTop ? handleDragEnd : undefined}
        onClick={isTop ? onTap : undefined}
      >
        {cardBody}

        {/* SAVE/SKIP overlays — top card only */}
        {isTop && (
          <>
            <motion.div
              className="absolute top-6 right-5 border-4 border-emerald-500 text-emerald-500 rounded-xl px-3 py-1.5 font-bold text-xl rotate-12 bg-white/80 backdrop-blur-sm pointer-events-none"
              style={{ opacity: saveOpacity }}
            >
              SAVE
            </motion.div>
            <motion.div
              className="absolute top-6 left-5 border-4 border-red-500 text-red-500 rounded-xl px-3 py-1.5 font-bold text-xl -rotate-12 bg-white/80 backdrop-blur-sm pointer-events-none"
              style={{ opacity: skipOpacity }}
            >
              SKIP
            </motion.div>
          </>
        )}
      </motion.div>
    )
  }

  // --- Fan mode ---
  // No layoutId here — prevents shared-element conflicts with the detail overlay.
  if (displayMode === 'fan') {
    const idx = cardIndex ?? 0
    const offset = fanOffset ?? 0
    const absOffset = Math.abs(offset)
    const isCenterCard = isFanCenter ?? offset === 0
    const isHighlighted = isFanHighlighted ?? isCenterCard
    const fanX = offset * 120
    const fanY = isCenterCard ? -28 : absOffset * 20
    const fanRotate = offset * 7
    const fanScale = isCenterCard ? 0.92 : Math.max(0.62, 0.8 - absOffset * 0.06)
    const fanZ = isHighlighted ? 220 : 120 - absOffset
    const fanShadow = isHighlighted
      ? '0 28px 48px -18px rgba(0, 0, 0, 0.45)'
      : '0 16px 28px -18px rgba(0, 0, 0, 0.35)'

    return (
      <motion.div
        ref={cardRef}
        className={`select-none rounded-3xl bg-white shadow-xl border overflow-hidden flex flex-col absolute inset-0 cursor-pointer ${
          isHighlighted ? 'border-primary/60 ring-2 ring-primary/20' : 'border-stone-100'
        }`}
        style={{ transformOrigin: 'bottom center' }}
        initial={{ opacity: 0, y: 40 }}
        animate={{
          opacity: 1,
          x: fanX,
          y: fanY,
          rotate: fanRotate,
          scale: fanScale,
          zIndex: fanZ,
          boxShadow: fanShadow,
        }}
        whileHover={{
          y: fanY - (isCenterCard ? 14 : 10),
          scale: fanScale * (isCenterCard ? 1.03 : 1.05),
          rotate: fanRotate * 0.92,
        }}
        transition={{ type: 'spring', stiffness: 260, damping: 24, delay: idx * 0.04 }}
        drag={false}
        onClick={onTap}
      >
        {cardBody}
      </motion.div>
    )
  }

  // --- Grid mode ---
  return (
    <motion.div
      ref={cardRef}
      className="relative w-full aspect-[3/4] select-none rounded-3xl bg-white shadow-xl border border-stone-100 overflow-hidden flex flex-col cursor-pointer"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: (cardIndex ?? 0) * 0.04 }}
      drag={false}
      onClick={onTap}
    >
      {cardBody}
    </motion.div>
  )
}
