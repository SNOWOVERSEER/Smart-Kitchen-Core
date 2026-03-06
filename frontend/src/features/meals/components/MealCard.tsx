import { useRef, useCallback, useState } from 'react'
import { motion, type PanInfo } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { CalendarDays, CalendarX2, GripVertical, BookOpen } from 'lucide-react'
import { MEAL_TYPE_CONFIG, EASE_OUT_EXPO } from '@/features/meals/lib/mealConstants'
import type { MealType } from '@/features/meals/lib/mealConstants'
import { useMealDragOptional } from '@/features/meals/lib/MealDragContext'
import type { MealResponse } from '@/shared/lib/api.types'

export interface MealCardProps {
  meal: MealResponse
  onSelect: (id: string) => void
  index: number
  enableDrag?: boolean
  onReschedule?: (mealId: string, newDate: string) => void
  onUnschedule?: (mealId: string) => void
}

export function MealCard({ meal, onSelect, index, enableDrag, onReschedule, onUnschedule }: MealCardProps) {
  const { t } = useTranslation()
  const dragCtx = useMealDragOptional()

  const [isDragging, setIsDragging] = useState(false)
  const cardRef = useRef<HTMLButtonElement>(null)
  const didDrag = useRef(false)

  const config = meal.meal_type
    ? MEAL_TYPE_CONFIG[meal.meal_type as MealType]
    : undefined
  const gradient = config ? config.gradient : 'from-stone-300 to-stone-400'
  const Icon = config?.icon
  const pillClass = config
    ? `${config.bgLight} ${config.textColor}`
    : 'bg-stone-100 text-stone-500'

  // Hit-test using the card's visual center (not the pointer position).
  // During drag, the card element moves with the pointer, so getBoundingClientRect
  // already reflects the dragged position.
  const hitTestCardCenter = useCallback(() => {
    if (!dragCtx || !cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    dragCtx.hitTestPointer(centerX, centerY)
  }, [dragCtx])

  const handleDragStart = useCallback(() => {
    if (!dragCtx) return
    didDrag.current = true
    setIsDragging(true)
    dragCtx.startDrag(meal.id)
    if (navigator.vibrate) navigator.vibrate(15)
  }, [dragCtx, meal.id])

  const handleDrag = useCallback(
    (_: unknown, _info: PanInfo) => {
      hitTestCardCenter()
    },
    [hitTestCardCenter],
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

  const canDrag = enableDrag && !!dragCtx

  return (
    <motion.button
      ref={cardRef}
      type="button"
      onClick={handleClick}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: EASE_OUT_EXPO }}
      whileTap={isDragging ? undefined : { scale: 0.97 }}
      drag={canDrag || undefined}
      dragSnapToOrigin
      whileDrag={{
        scale: 0.5,
        boxShadow: '0 16px 48px -8px rgba(28,22,18,0.3)',
        zIndex: 50,
        transition: { scale: { duration: 0.25, ease: EASE_OUT_EXPO } },
      }}
      onDragStart={canDrag ? handleDragStart : undefined}
      onDrag={canDrag ? handleDrag : undefined}
      onDragEnd={canDrag ? handleDragEnd : undefined}
      style={isDragging ? { zIndex: 50, position: 'relative' } : undefined}
      className="w-full bg-white rounded-2xl border border-stone-200/60 shadow-[0_2px_16px_-6px_rgba(28,22,18,0.09)] overflow-hidden text-left cursor-pointer flex flex-row touch-none"
    >
      {/* Left accent bar */}
      <div className={`w-[3px] shrink-0 bg-gradient-to-b ${gradient}`} />

      {/* Content */}
      <div className="flex-1 p-3.5 flex flex-col gap-2 min-w-0">
        <p className="text-[15px] font-semibold text-[#1C1612] truncate leading-snug">
          {meal.name}
        </p>

        <div className="flex items-center gap-2">
          {meal.is_template ? (
            <span className="text-xs text-primary/70 flex items-center gap-1 font-medium">
              <BookOpen className="w-3 h-3" />
              {meal.instance_count != null && meal.instance_count > 0
                ? t('meals.usedCount', 'Used {{count}} times', { count: meal.instance_count })
                : t('meals.template', 'Template')}
            </span>
          ) : meal.scheduled_date ? (
            <span className="text-xs text-stone-500 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              {format(parseISO(meal.scheduled_date), 'MMM d')}
              {onUnschedule && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    onUnschedule(meal.id)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      onUnschedule(meal.id)
                    }
                  }}
                  className="ml-0.5 p-0.5 rounded-full text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <CalendarX2 className="w-3 h-3" />
                </span>
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
          <div className="flex flex-col gap-1.5">
            {/* Recipe names */}
            <p className="text-[12px] text-stone-500 truncate leading-snug">
              {meal.recipes.slice(0, 2).map((r) => r.title).join(', ')}
              {meal.recipes.length > 2 && ` +${meal.recipes.length - 2}`}
            </p>
            {/* Thumbnails row */}
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
          </div>
        ) : (
          <span className="text-[11px] text-stone-400 italic">
            {t('meals.noRecipesInMeal', 'No recipes yet')}
          </span>
        )}
      </div>

      {/* Drag handle indicator */}
      {enableDrag && (
        <div className="flex items-center px-2 cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4 text-stone-300" />
        </div>
      )}
    </motion.button>
  )
}
