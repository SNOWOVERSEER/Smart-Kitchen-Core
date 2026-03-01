import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, X, Heart, LayoutGrid, Layers, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSaveRecipe } from '@/features/recipes/hooks/useRecipes'
import { RecipeCard3D } from './RecipeCard3D'
import { RecipeDetailOverlay } from './RecipeDetailOverlay'
import type { RecipeCard } from '@/shared/lib/api.types'

// How many cards to show stacked at once in stack mode
const STACK_VISIBLE = 4
const FAN_OPEN_DELAY_MS = 220
const FAN_Z_LIFT_DELAY_MS = 170

function getCircularOffset(index: number, centerIndex: number, total: number) {
  if (total <= 0) return 0
  let offset = index - centerIndex
  if (offset > total / 2) offset -= total
  if (offset < -total / 2) offset += total
  return offset
}

interface Props {
  recipes: RecipeCard[]
  isGenerating?: boolean
  sourceMode: string
  sourcePrompt?: string
  onGenerateMore: () => void
  heartRef: React.RefObject<HTMLButtonElement | null>
  onHeartPulse: () => void
  onViewModeChange?: (mode: 'stack' | 'fan' | 'grid') => void
}

/** Dark tarot card back with terracotta accent */
function TarotBack() {
  return (
    <div className="w-full h-full bg-[#1C1612] rounded-3xl border-[5px] border-primary/70 flex items-center justify-center overflow-hidden relative shadow-2xl">
      <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-[#1C1612] to-[#1C1612]" />
      <div className="absolute inset-3 border border-primary/25 rounded-2xl" />
      <div className="w-24 h-24 border-2 border-primary/50 rounded-full flex items-center justify-center">
        <div className="w-16 h-16 border border-primary/35 rounded-full rotate-45 flex items-center justify-center">
          <Sparkles className="text-primary/60 w-7 h-7" />
        </div>
      </div>
      <div className="absolute top-5 left-5 text-primary/35"><Sparkles size={14} /></div>
      <div className="absolute bottom-5 right-5 text-primary/35"><Sparkles size={14} /></div>
    </div>
  )
}

export function RecipeCardDeck({
  recipes,
  isGenerating = false,
  sourceMode,
  sourcePrompt,
  onGenerateMore,
  heartRef,
  onHeartPulse,
  onViewModeChange,
}: Props) {
  const { t } = useTranslation()
  const [viewMode, setViewMode] = useState<'stack' | 'fan' | 'grid'>('stack')
  const [detailRecipe, setDetailRecipe] = useState<RecipeCard | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [flyState, setFlyState] = useState<{ from: DOMRect; to: DOMRect; imageUrl?: string } | null>(null)
  // Unified tracking: titles of recipes the user has saved or skipped
  const [actedOnTitles, setActedOnTitles] = useState<Set<string>>(new Set())
  // Fan mode: which card is centered in the roulette
  const [fanCenterIndex, setFanCenterIndex] = useState(0)
  const [fanHighlightIndex, setFanHighlightIndex] = useState(0)
  const [fanPendingOpenTitle, setFanPendingOpenTitle] = useState<string | null>(null)
  const topCardRef = useRef<HTMLDivElement | null>(null)
  const fanLiftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveRecipe = useSaveRecipe()

  const allRemaining = recipes.filter(r => !actedOnTitles.has(r.title))
  const hasDeck = allRemaining.length > 0
  const isDone = recipes.length > 0 && allRemaining.length === 0

  const normalizedFanCenterIndex =
    allRemaining.length > 0
      ? ((fanCenterIndex % allRemaining.length) + allRemaining.length) % allRemaining.length
      : 0

  const normalizedFanHighlightIndex =
    allRemaining.length > 0
      ? ((fanHighlightIndex % allRemaining.length) + allRemaining.length) % allRemaining.length
      : 0

  function clearFanLiftTimer() {
    if (!fanLiftTimerRef.current) return
    clearTimeout(fanLiftTimerRef.current)
    fanLiftTimerRef.current = null
  }

  function scheduleFanHighlight(nextIndex: number) {
    clearFanLiftTimer()
    fanLiftTimerRef.current = setTimeout(() => {
      setFanHighlightIndex(nextIndex)
      fanLiftTimerRef.current = null
    }, FAN_Z_LIFT_DELAY_MS)
  }

  useEffect(() => {
    return () => {
      if (!fanLiftTimerRef.current) return
      clearTimeout(fanLiftTimerRef.current)
      fanLiftTimerRef.current = null
    }
  }, [])

  useEffect(() => {
    onViewModeChange?.(viewMode)
  }, [onViewModeChange, viewMode])

  useEffect(() => {
    if (!fanPendingOpenTitle || allRemaining.length === 0) return
    const centeredRecipe = allRemaining[normalizedFanCenterIndex]
    if (!centeredRecipe || centeredRecipe.title !== fanPendingOpenTitle) return

    const timer = setTimeout(() => {
      setDetailRecipe(centeredRecipe)
      setIsDetailOpen(true)
      setFanPendingOpenTitle(null)
    }, FAN_OPEN_DELAY_MS)

    return () => clearTimeout(timer)
  }, [allRemaining, normalizedFanCenterIndex, fanPendingOpenTitle])

  function handleLike(recipe: RecipeCard) {
    clearFanLiftTimer()
    setFanPendingOpenTitle(null)
    // Fly animation only in stack mode where topCardRef is populated
    if (viewMode === 'stack') {
      const from = topCardRef.current?.getBoundingClientRect()
      const to = heartRef.current?.getBoundingClientRect()
      const imageUrl = 'image_url' in recipe && typeof recipe.image_url === 'string' ? recipe.image_url : undefined
      // Guard: on mobile the desktop heartRef returns zero-size DOMRect
      if (from && to && to.width > 0) setFlyState({ from, to, imageUrl })
    }
    setActedOnTitles(prev => new Set([...prev, recipe.title]))
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

  function handleSkip(recipe?: RecipeCard) {
    clearFanLiftTimer()
    setFanPendingOpenTitle(null)
    const target = recipe ?? allRemaining[0]
    if (target) setActedOnTitles(prev => new Set([...prev, target.title]))
  }

  function rotateFan(step: -1 | 1) {
    if (allRemaining.length < 2) return
    setFanPendingOpenTitle(null)
    const nextIndex = (normalizedFanCenterIndex + step + allRemaining.length) % allRemaining.length
    setFanCenterIndex(nextIndex)
    scheduleFanHighlight(nextIndex)
  }

  function handleFanCardTap(recipe: RecipeCard, index: number) {
    if (index === normalizedFanCenterIndex) {
      setDetailRecipe(recipe)
      setIsDetailOpen(true)
      return
    }
    setFanCenterIndex(index)
    scheduleFanHighlight(index)
    setFanPendingOpenTitle(recipe.title)
  }

  // ── Tarot initial state ───────────────────────────────────────────
  if (!isGenerating && !hasDeck && !isDone) {
    return (
      // Explicit width — avoids w-full collapsing to 0 in flex-col items-center parents
      <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-8 pb-[calc(env(safe-area-inset-bottom)+4.6rem)] [@media(max-height:760px)]:pb-[calc(env(safe-area-inset-bottom)+4rem)]">
        <div className="relative mx-auto aspect-[3/4] h-[min(46vh,420px)] [@media(max-height:900px)]:h-[min(44vh,390px)] [@media(max-height:760px)]:h-[min(40vh,330px)] w-auto max-w-[78vw] [@media(max-width:430px)]:max-w-[72vw] [@media(max-width:380px)]:max-w-[68vw] sm:max-w-[68vw] lg:h-[min(58vh,520px)] lg:max-w-[360px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={`tarot-${i}`}
              className="absolute inset-0"
              animate={{
                rotate: (i - 2) * 6,
                y: Math.abs(i - 2) * 8,
                x: (i - 2) * 12,
              }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <TarotBack />
            </motion.div>
          ))}

          {/* Awaiting pill */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="absolute bottom-2 [@media(max-height:760px)]:bottom-1 left-0 right-0 flex justify-center pointer-events-none z-20"
          >
            <div className="max-w-[calc(100vw-1.5rem)] bg-card/92 backdrop-blur-md px-4 py-2 [@media(max-width:380px)]:px-3.5 [@media(max-width:380px)]:py-1.5 rounded-full font-display text-foreground font-semibold shadow-xl border border-border flex items-center justify-center gap-2 text-sm [@media(max-width:380px)]:text-[13px] text-center leading-tight">
              <Sparkles size={14} className="text-primary shrink-0" />
              <span className="min-w-0 break-words">{t('recipes.initialHint')}</span>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Shuffling / generating state ──────────────────────────────────
  if (isGenerating) {
    return (
      <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-4 pb-[calc(env(safe-area-inset-bottom)+4rem)]">
        <div className="relative mx-auto aspect-[3/4] h-[min(46vh,420px)] [@media(max-height:900px)]:h-[min(44vh,390px)] [@media(max-height:760px)]:h-[min(40vh,330px)] w-auto max-w-[78vw] [@media(max-width:430px)]:max-w-[72vw] [@media(max-width:380px)]:max-w-[68vw] sm:max-w-[68vw] lg:h-[min(58vh,520px)] lg:max-w-[360px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={`shuffle-${i}`}
              className="absolute inset-0"
              animate={{
                x: [0, -120, 0, 0],
                y: [0, -50, 15, 0],
                rotate: [0, -12, 4, 0],
              }}
              transition={{
                duration: 1.2,
                repeat: Infinity,
                times: [0, 0.3, 0.6, 1],
                ease: 'easeInOut',
                delay: i * 0.24,
              }}
            >
              <TarotBack />
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  // ── All cards done ────────────────────────────────────────────────
  if (isDone) {
    return (
      <div className="flex flex-1 min-h-0 flex-col items-center justify-center gap-5 py-10 pb-[calc(env(safe-area-inset-bottom)+4rem)]">
        <div className="relative mx-auto aspect-[3/4] h-[min(46vh,420px)] [@media(max-height:900px)]:h-[min(44vh,390px)] [@media(max-height:760px)]:h-[min(40vh,330px)] w-auto max-w-[78vw] [@media(max-width:430px)]:max-w-[72vw] [@media(max-width:380px)]:max-w-[68vw] sm:max-w-[68vw] lg:h-[min(58vh,520px)] lg:max-w-[360px] opacity-40">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={`done-${i}`}
              className="absolute inset-0"
              animate={{ rotate: (i - 1) * 4, y: i * 6, x: (i - 1) * 8 }}
            >
              <TarotBack />
            </motion.div>
          ))}
        </div>
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">{t('recipes.noMoreRecipes')}</p>
          <button
            onClick={onGenerateMore}
            className="px-6 py-2.5 bg-muted text-foreground rounded-full font-medium text-sm hover:bg-muted/80 transition-colors flex items-center gap-2 mx-auto"
          >
            <Sparkles size={14} className="text-primary" />
            {t('recipes.regenerate')}
          </button>
        </div>
      </div>
    )
  }

  // ── Active deck ────────────────────────────────────────────────────
  const visibleStack = allRemaining.slice(0, STACK_VISIBLE)
  const visibleCount = visibleStack.length

  // Fan mode: X/Heart act on centered card
  const fanTarget = allRemaining[normalizedFanCenterIndex]
  const fanArrowButtonClass = 'absolute top-1/2 -translate-y-1/2 z-30 grid h-11 w-11 place-items-center rounded-2xl border border-stone-200/90 bg-gradient-to-b from-white to-stone-100/95 text-stone-600 shadow-[0_12px_26px_-14px_rgba(0,0,0,0.55)] backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:text-primary hover:shadow-[0_16px_32px_-14px_rgba(0,0,0,0.6)] active:scale-95 disabled:opacity-35 disabled:pointer-events-none'

  // Segmented mode toggle
  const modeToggle = (
    <div className="flex items-center gap-0.5 bg-stone-100 rounded-full p-1">
      {([
        { mode: 'stack' as const, icon: <Layers size={14} />, label: t('recipes.stackedView') },
        { mode: 'fan' as const, icon: <Sparkles size={14} />, label: t('recipes.spreadView') },
        { mode: 'grid' as const, icon: <LayoutGrid size={14} />, label: t('recipes.gridView') },
      ] as const).map(({ mode, icon, label }) => (
        <button
          key={mode}
          onClick={() => {
            if (mode === 'fan') setFanHighlightIndex(normalizedFanCenterIndex)
            if (mode !== 'fan') {
              clearFanLiftTimer()
              setFanPendingOpenTitle(null)
            }
            setViewMode(mode)
          }}
          title={label}
          className={`p-2 rounded-full transition-all ${viewMode === mode ? 'bg-white shadow-sm text-foreground' : 'text-stone-400 hover:text-stone-600'}`}
        >
          {icon}
        </button>
      ))}
    </div>
  )

  const actionButtons = (
    <>
      {/* Skip */}
      <button
        onClick={() => {
          if (viewMode === 'fan') {
            if (fanTarget) handleSkip(fanTarget)
            return
          }
          handleSkip()
        }}
        aria-label={t('recipes.skip')}
        className="w-14 h-14 rounded-full bg-white text-stone-400 shadow-md flex items-center justify-center hover:text-red-500 hover:shadow-lg transition-all border border-stone-100"
      >
        <X size={26} />
      </button>

      {modeToggle}

      {/* Save / Like */}
      <button
        onClick={() => {
          if (viewMode === 'fan') {
            if (fanTarget) handleLike(fanTarget)
            return
          }
          const topRecipe = allRemaining[0]
          if (topRecipe) handleLike(topRecipe)
        }}
        disabled={saveRecipe.isPending || allRemaining.length === 0 || (viewMode === 'fan' && !fanTarget)}
        aria-label={t('recipes.save')}
        className="w-14 h-14 rounded-full bg-primary text-white shadow-md shadow-primary/30 flex items-center justify-center hover:scale-110 hover:shadow-lg transition-all disabled:opacity-50"
      >
        <Heart size={26} fill="currentColor" />
      </button>
    </>
  )
  const mobileModeDockClass = 'bottom-[calc(env(safe-area-inset-bottom)+clamp(4.6rem,8.8vh,6.6rem))]'

  return (
    <div
      className={`w-full min-h-0 overflow-x-hidden ${viewMode === 'grid' ? 'flex flex-col gap-4' : 'flex h-full min-h-0 flex-col overflow-hidden'
        }`}
    >
      {/* Card area */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 px-3 sm:px-4 lg:px-0 pb-20 lg:pb-2">
          {allRemaining.map((recipe, idx) => (
            <RecipeCard3D
              key={`grid-${recipe.title}`}
              recipe={recipe}
              displayMode="grid"
              isTop={false}
              stackIndex={0}
              cardIndex={idx}
              onLike={() => handleLike(recipe)}
              onSkip={() => handleSkip(recipe)}
              onTap={() => { setDetailRecipe(recipe); setIsDetailOpen(true) }}
            />
          ))}
        </div>
      ) : (
        <div className="relative flex-1 min-h-0 overflow-visible">
          {viewMode === 'fan' ? (
            <div className="relative mx-auto flex h-full w-full max-w-[700px] min-h-0 flex-col items-center justify-center overflow-visible px-3 pt-2 pb-3 sm:px-8 lg:px-10 touch-none">
              <div className="relative flex w-full flex-1 min-h-0 items-center justify-center">
                <button
                  type="button"
                  onClick={() => rotateFan(-1)}
                  disabled={allRemaining.length < 2}
                  aria-label="Rotate cards left"
                  className={`${fanArrowButtonClass} left-0 sm:left-2 lg:left-4`}
                >
                  <ChevronLeft size={18} className="mx-auto" />
                </button>

                <div
                  className="relative z-10 mx-auto aspect-[3/4] h-[min(100%,500px)] [@media(max-height:840px)]:h-[min(100%,440px)] [@media(max-height:760px)]:h-[min(100%,380px)] w-auto max-w-[80vw] [@media(max-width:430px)]:max-w-[74vw] [@media(max-width:380px)]:max-w-[70vw] sm:max-w-[72vw] lg:max-w-[360px] translate-y-[clamp(2px,0.8vh,10px)] lg:translate-y-0"
                  style={{ perspective: 1000 }}
                >
                  {allRemaining.map((recipe, idx) => {
                    const fanOffset = getCircularOffset(idx, normalizedFanCenterIndex, allRemaining.length)
                    return (
                      <RecipeCard3D
                        key={recipe.title}
                        recipe={recipe}
                        displayMode="fan"
                        isTop={fanOffset === 0}
                        stackIndex={0}
                        cardIndex={idx}
                        fanOffset={fanOffset}
                        isFanCenter={fanOffset === 0}
                        isFanHighlighted={idx === normalizedFanHighlightIndex}
                        onLike={() => handleLike(recipe)}
                        onSkip={() => handleSkip(recipe)}
                        onTap={() => handleFanCardTap(recipe, idx)}
                        disabled={saveRecipe.isPending}
                      />
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => rotateFan(1)}
                  disabled={allRemaining.length < 2}
                  aria-label="Rotate cards right"
                  className={`${fanArrowButtonClass} right-0 sm:right-2 lg:right-4`}
                >
                  <ChevronRight size={18} className="mx-auto" />
                </button>
              </div>

              <div className="lg:hidden relative z-[60] mt-[clamp(16px,2.6vh,30px)] flex items-center justify-center gap-4 pointer-events-auto">
                {actionButtons}
              </div>
            </div>
          ) : (
            // Stack mode — hide the recipe being shown in detail overlay
            <div className="relative mx-auto flex h-full w-full min-h-0 flex-col items-center justify-center overflow-visible pt-2 pb-3 lg:pb-8">
              <div className="relative flex w-full flex-1 min-h-0 items-center justify-center">
                <div
                  className="relative z-10 aspect-[3/4] h-[min(100%,480px)] [@media(max-height:840px)]:h-[min(100%,430px)] [@media(max-height:760px)]:h-[min(100%,370px)] w-auto max-w-[80vw] [@media(max-width:430px)]:max-w-[74vw] [@media(max-width:380px)]:max-w-[69vw] sm:max-w-[72vw] lg:max-w-[340px] translate-y-[clamp(0px,0.4vh,6px)] lg:translate-y-0"
                  style={{ perspective: 1000 }}
                >
                  {[...visibleStack].reverse().map((recipe, revIdx) => {
                    const stackIndex = (Math.min(visibleCount, STACK_VISIBLE) - 1 - revIdx) as 0 | 1 | 2 | 3
                    const isTop = stackIndex === 0
                    if (isDetailOpen && detailRecipe?.title === recipe.title) return null
                    return (
                      <RecipeCard3D
                        key={recipe.title}
                        recipe={recipe}
                        displayMode="stack"
                        isTop={isTop}
                        stackIndex={stackIndex}
                        cardRef={isTop ? topCardRef : undefined}
                        onLike={() => handleLike(recipe)}
                        onSkip={() => handleSkip(recipe)}
                        onTap={() => { if (isTop) { setDetailRecipe(recipe); setIsDetailOpen(true) } }}
                        disabled={isTop && saveRecipe.isPending}
                      />
                    )
                  })}
                </div>
              </div>

              <div className="lg:hidden relative z-[60] mt-[clamp(16px,2.6vh,30px)] flex items-center justify-center gap-4 pointer-events-auto">
                {actionButtons}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {viewMode !== 'grid' ? (
        <>
          <div className="hidden lg:flex relative z-20 w-full items-center justify-center gap-4">
            {actionButtons}
          </div>
        </>
      ) : (
        <>
          <div className="hidden lg:flex w-full justify-center">
            {modeToggle}
          </div>
          <div className={`lg:hidden fixed left-1/2 -translate-x-1/2 ${mobileModeDockClass} z-30`}>
            <div className="bg-white/95 backdrop-blur-md border border-stone-200 shadow-lg rounded-full p-1">
              {modeToggle}
            </div>
          </div>
        </>
      )}

      {/* Flying card animation — portal to body so no ancestor CSS interferes */}
      {flyState && createPortal(
        <motion.div
          className="fixed top-0 left-0 z-[500] rounded-3xl shadow-2xl overflow-hidden pointer-events-none border-4 border-primary origin-center"
          style={{ width: flyState.from.width, height: flyState.from.height }}
          initial={{
            x: flyState.from.left,
            y: flyState.from.top,
            scale: 1,
            opacity: 1,
            rotate: 8,
          }}
          animate={{
            x: flyState.to.x + flyState.to.width / 2 - flyState.from.width / 2,
            y: flyState.to.y + flyState.to.height / 2 - flyState.from.height / 2,
            scale: 0.05,
            opacity: 0,
            rotate: 180,
          }}
          transition={{ duration: 0.65, ease: [0.32, 0.72, 0, 1] }}
          onAnimationComplete={() => setFlyState(null)}
        >
          {flyState.imageUrl ? (
            <img src={flyState.imageUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-amber-100 to-orange-100" />
          )}
        </motion.div>,
        document.body
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
          if (detailRecipe) handleSkip(detailRecipe)
          setIsDetailOpen(false)
        }}
      />
    </div>
  )
}
