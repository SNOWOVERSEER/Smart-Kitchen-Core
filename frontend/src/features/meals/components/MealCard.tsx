import { useRef, useCallback, useEffect, useState } from 'react'
import { motion, type PanInfo } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { CalendarDays, CalendarX2, GripVertical } from 'lucide-react'
import { MEAL_TYPE_CONFIG, EASE_OUT_EXPO } from '@/features/meals/lib/mealConstants'
import type { MealType } from '@/features/meals/lib/mealConstants'
import { useMealDragOptional } from '@/features/meals/lib/MealDragContext'
import type { MealResponse } from '@/shared/lib/api.types'

export interface MealCardProps {
  meal: MealResponse
  onSelect: (id: number) => void
  index: number
  enableDrag?: boolean
  onReschedule?: (mealId: number, newDate: string) => void
  onUnschedule?: (mealId: number) => void
}

const LONG_PRESS_MS = 200
const MOVE_THRESHOLD_PX = 6

export function MealCard({ meal, onSelect, index, enableDrag, onReschedule, onUnschedule }: MealCardProps) {
  const { t } = useTranslation()
  const dragCtx = useMealDragOptional()

  const [isDragging, setIsDragging] = useState(false)
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pointerOrigin = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const didDrag = useRef(false)

  const config = meal.meal_type
    ? MEAL_TYPE_CONFIG[meal.meal_type as MealType]
    : undefined
  const gradient = config ? config.gradient : 'from-stone-300 to-stone-400'
  const Icon = config?.icon
  const pillClass = config
    ? `${config.bgLight} ${config.textColor}`
    : 'bg-stone-100 text-stone-500'

  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current)
    }
  }, [])

  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const activateDrag = useCallback(() => {
    if (!dragCtx) return
    cancelLongPress()
    didDrag.current = true
    setIsDragging(true)
    dragCtx.startDrag(meal.id)
    if (navigator.vibrate) navigator.vibrate(20)
  }, [dragCtx, meal.id, cancelLongPress])

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enableDrag || !dragCtx) return
      pointerOrigin.current = { x: e.clientX, y: e.clientY }
      didDrag.current = false
      longPressTimer.current = setTimeout(activateDrag, LONG_PRESS_MS)
    },
    [enableDrag, dragCtx, activateDrag],
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!longPressTimer.current) return
      const dx = e.clientX - pointerOrigin.current.x
      const dy = e.clientY - pointerOrigin.current.y
      if (Math.sqrt(dx * dx + dy * dy) > MOVE_THRESHOLD_PX) {
        cancelLongPress()
      }
    },
    [cancelLongPress],
  )

  const handlePointerUp = useCallback(() => {
    cancelLongPress()
  }, [cancelLongPress])

  // Grip handle: instant drag activation on pointer down
  const handleGripPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation()
      if (!enableDrag || !dragCtx) return
      pointerOrigin.current = { x: e.clientX, y: e.clientY }
      activateDrag()
    },
    [enableDrag, dragCtx, activateDrag],
  )

  // Use info.point for absolute pointer position (not offset-based)
  const handleDrag = useCallback(
    (_: unknown, info: PanInfo) => {
      if (!dragCtx) return
      dragCtx.hitTestPointer(info.point.x, info.point.y)
    },
    [dragCtx],
  )

  const handleDragEnd = useCallback(() => {
    if (!dragCtx) return
    if (dragCtx.hoveredDate && onReschedule) {
      onReschedule(meal.id, dragCtx.hoveredDate)
    }
    dragCtx.endDrag()
    setIsDragging(false)
  }, [dragCtx, meal.id, onReschedule])

  const handleClick = useCallback(() => {
    if (didDrag.current) {
      didDrag.current = false
      return
    }
    onSelect(meal.id)
  }, [onSelect, meal.id])

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: EASE_OUT_EXPO }}
      whileTap={isDragging ? undefined : { scale: 0.97 }}
      drag={isDragging}
      dragSnapToOrigin
      whileDrag={{ scale: 1.04, boxShadow: '0 16px 48px -8px rgba(28,22,18,0.3)', zIndex: 50 }}
      onDrag={isDragging ? handleDrag : undefined}
      onDragEnd={isDragging ? handleDragEnd : undefined}
      style={isDragging ? { zIndex: 50, position: 'relative' } : undefined}
      className="w-full bg-white rounded-2xl border border-stone-200/60 shadow-[0_2px_16px_-6px_rgba(28,22,18,0.09)] overflow-hidden text-left cursor-pointer flex flex-row"
    >
      {/* Left accent bar */}
      <div className={`w-[3px] shrink-0 bg-gradient-to-b ${gradient}`} />

      {/* Content */}
      <div className="flex-1 p-3.5 flex flex-col gap-2 min-w-0">
        <p className="text-[15px] font-semibold text-[#1C1612] truncate leading-snug">
          {meal.name}
        </p>

        <div className="flex items-center gap-2">
          {meal.scheduled_date ? (
            <span className="text-xs text-stone-500 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {format(parseISO(meal.scheduled_date), 'MMM d')}
              {onUnschedule && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    onUnschedule(meal.id)
                  }}
                  className="ml-0.5 p-0.5 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <CalendarX2 className="w-3 h-3" />
                </button>
              )}
            </span>
          ) : (
            <span className="text-xs text-stone-400 italic">
              {t('meals.unscheduled', 'Unscheduled')}
            </span>
          )}
          {meal.meal_type && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${pillClass}`}
            >
              {Icon && <Icon className="w-3 h-3" />}
              {t(`meals.${meal.meal_type}`, meal.meal_type)}
            </span>
          )}
        </div>

        {meal.recipes.length > 0 ? (
          <div className="flex items-center">
            {meal.recipes.slice(0, 3).map((r, i) => (
              <div
                key={r.recipe_id}
                className={`w-6 h-6 rounded-full overflow-hidden border-2 border-white shrink-0 ${i > 0 ? '-ml-1' : ''}`}
              >
                {r.image_url ? (
                  <img src={r.image_url} alt={r.title} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradient}`} />
                )}
              </div>
            ))}
            <span className="ml-1.5 text-[11px] text-stone-400">
              {t('meals.recipeCount', '{{count}} recipes', { count: meal.recipes.length })}
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-stone-400">
            {t('meals.recipeCount', '{{count}} recipes', { count: 0 })}
          </span>
        )}
      </div>

      {/* Drag handle — instant drag on touch */}
      {enableDrag && (
        <div
          onPointerDown={handleGripPointerDown}
          className="flex items-center px-2 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-4 h-4 text-stone-300" />
        </div>
      )}
    </motion.button>
  )
}
