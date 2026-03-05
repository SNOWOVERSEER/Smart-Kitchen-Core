import { useState, useRef, useCallback, useLayoutEffect } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  startOfWeek,
  addDays,
  addWeeks,
  format,
  isSameDay,
  isToday,
} from 'date-fns'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { EASE_OUT_EXPO, MEAL_TYPE_CONFIG, DEFAULT_MEAL_DOT, type MealType } from '../lib/mealConstants'
import { useMealDragOptional } from '../lib/MealDragContext'

interface WeekCalendarStripProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  mealDates: Set<string>
  /** Maps date string → set of meal_type values present on that date */
  mealDateTypes?: Map<string, string[]>
  className?: string
}

export function WeekCalendarStrip({
  selectedDate,
  onSelectDate,
  mealDates,
  mealDateTypes,
  className,
}: WeekCalendarStripProps) {
  const { t } = useTranslation()
  const [weekOffset, setWeekOffset] = useState(0)
  const [direction, setDirection] = useState(1)
  const dragCtx = useMealDragOptional()
  const dayRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const isDragging = dragCtx?.draggedMealId != null
  const hoveredDate = dragCtx?.hoveredDate ?? null

  const weekStart = startOfWeek(addWeeks(new Date(), weekOffset), {
    weekStartsOn: 1,
  })
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  // Register day cell rects for hit-testing
  useLayoutEffect(() => {
    if (!dragCtx) return
    const rects = Array.from(dayRefs.current.entries()).map(([dateKey, el]) => ({
      dateKey,
      rect: el.getBoundingClientRect(),
    }))
    dragCtx.registerDayRects(rects)
  })

  const setDayRef = useCallback((dateKey: string, el: HTMLDivElement | null) => {
    if (el) dayRefs.current.set(dateKey, el)
    else dayRefs.current.delete(dateKey)
  }, [])

  function goToPrevWeek() {
    setDirection(-1)
    setWeekOffset((prev) => prev - 1)
  }

  function goToNextWeek() {
    setDirection(1)
    setWeekOffset((prev) => prev + 1)
  }

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border shadow-[0_2px_12px_-4px_rgba(28,22,18,0.08)] px-3 py-3 transition-all duration-200',
        isDragging
          ? 'border-primary/50 ring-2 ring-primary/15 shadow-[0_4px_20px_-4px_rgba(28,22,18,0.15)]'
          : 'border-stone-200/60',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          onClick={goToPrevWeek}
          className="w-7 h-7 rounded-full hover:bg-stone-100 flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-stone-400" />
        </button>
        <motion.span
          animate={{ opacity: 1 }}
          className={cn(
            'text-[11px] font-bold uppercase tracking-[0.09em]',
            isDragging ? 'text-primary' : 'text-stone-400',
          )}
        >
          {isDragging
            ? t('meals.dropToReschedule', 'Drop on a day to schedule')
            : format(weekStart, 'MMM yyyy')}
        </motion.span>
        <button
          onClick={goToNextWeek}
          className="w-7 h-7 rounded-full hover:bg-stone-100 flex items-center justify-center transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-stone-400" />
        </button>
      </div>

      {/* Days */}
      <LayoutGroup>
        <motion.div
          drag={isDragging ? false : 'x'}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.15}
          onDragEnd={(_, info) => {
            if (info.offset.x > 60) goToPrevWeek()
            else if (info.offset.x < -60) goToNextWeek()
          }}
          style={{ touchAction: 'pan-y' }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={weekOffset}
              initial={{ opacity: 0, x: direction > 0 ? 40 : -40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction > 0 ? -40 : 40 }}
              transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              className="flex items-end"
            >
              {days.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd')
                const isSelected = isSameDay(day, selectedDate)
                const isTodayDate = isToday(day)
                const hasMeals = mealDates.has(dateKey)
                const dayAbbr = format(day, 'EEE').slice(0, 2)
                const isHovered = isDragging && hoveredDate === dateKey
                const hasAnyHover = isDragging && hoveredDate != null

                return (
                  <motion.div
                    key={dateKey}
                    ref={(el) => setDayRef(dateKey, el)}
                    onClick={() => onSelectDate(day)}
                    // Expand hovered day, compress others
                    animate={{
                      flex: isHovered ? 3 : hasAnyHover ? 0.6 : 1,
                    }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    className="flex flex-col items-center gap-1 py-1 cursor-pointer overflow-hidden"
                  >
                    <span
                      className={cn(
                        'text-[10px] uppercase tracking-wider transition-colors whitespace-nowrap',
                        isHovered
                          ? 'text-primary font-bold'
                          : isSelected
                            ? 'text-stone-900 font-semibold'
                            : 'text-stone-400',
                      )}
                    >
                      {isHovered ? format(day, 'EEE') : dayAbbr}
                    </span>

                    <motion.div
                      className={cn(
                        'rounded-2xl flex items-center justify-center relative',
                        isHovered ? 'w-full min-h-[3.2rem]' : 'w-9 h-9',
                      )}
                      layout
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    >
                      {/* Selected day pill (normal state) */}
                      {isSelected && !isHovered && (
                        <motion.div
                          layoutId="calendar-selected-day"
                          className="absolute inset-0 rounded-full bg-[#1C1612]"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}

                      {/* Hovered drop target — expanded pill */}
                      {isHovered && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="absolute inset-0 rounded-2xl bg-primary/10 border-2 border-dashed border-primary/50"
                        />
                      )}

                      <span
                        className={cn(
                          'relative z-10 font-medium whitespace-nowrap',
                          isHovered
                            ? 'text-primary text-sm font-bold'
                            : isSelected
                              ? 'text-white text-sm'
                              : isTodayDate
                                ? 'bg-stone-100 rounded-full w-9 h-9 flex items-center justify-center text-[#1C1612] text-sm font-semibold'
                                : 'text-stone-600 text-sm',
                        )}
                      >
                        {isHovered
                          ? format(day, 'MMM d')
                          : format(day, 'd')}
                      </span>
                    </motion.div>

                    <div
                      className={cn(
                        'flex items-center gap-[3px] mt-1 transition-opacity h-1.5',
                        hasAnyHover && !isHovered ? 'opacity-0' : 'opacity-100',
                      )}
                    >
                      {hasMeals ? (
                        (mealDateTypes?.get(dateKey) ?? ['_default']).slice(0, 3).map((type, i) => {
                          const config = MEAL_TYPE_CONFIG[type as MealType]
                          return (
                            <div
                              key={`${type}-${i}`}
                              className={cn('w-1.5 h-1.5 rounded-full', config?.dotColor ?? DEFAULT_MEAL_DOT)}
                            />
                          )
                        })
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-transparent" />
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>
    </div>
  )
}
