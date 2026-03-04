import { useMemo, useRef, useCallback, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, CalendarX2 } from 'lucide-react'
import {
  startOfWeek,
  addDays,
  format,
  isSameDay,
  isToday,
} from 'date-fns'
import { cn } from '@/lib/utils'
import { useMealDragOptional } from '../lib/MealDragContext'
import type { MealResponse } from '@/shared/lib/api.types'

interface WeekScheduleViewProps {
  selectedDate: Date
  onSelectDate: (date: Date) => void
  meals: MealResponse[]
  onSelectMeal: (id: number) => void
  onUnschedule?: (mealId: number) => void
  className?: string
}

export function WeekScheduleView({
  selectedDate,
  onSelectDate,
  meals,
  onSelectMeal,
  onUnschedule,
  className,
}: WeekScheduleViewProps) {
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const mealsByDate = useMemo(() => {
    const map = new Map<string, MealResponse[]>()
    for (const meal of meals) {
      if (!meal.scheduled_date) continue
      const existing = map.get(meal.scheduled_date) ?? []
      existing.push(meal)
      map.set(meal.scheduled_date, existing)
    }
    return map
  }, [meals])

  // Drag context for drop-target registration
  const dragCtx = useMealDragOptional()
  const dayRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const isDragging = dragCtx?.draggedMealId != null
  const hoveredDate = dragCtx?.hoveredDate ?? null

  // Register day cell rects for hit-testing (same pattern as WeekCalendarStrip)
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

  const goToPrevWeek = () => onSelectDate(addDays(selectedDate, -7))
  const goToNextWeek = () => onSelectDate(addDays(selectedDate, 7))

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border shadow-[0_2px_12px_-4px_rgba(28,22,18,0.08)] overflow-hidden transition-all duration-200',
        isDragging
          ? 'border-primary/50 ring-2 ring-primary/15 shadow-[0_4px_20px_-4px_rgba(28,22,18,0.15)]'
          : 'border-stone-200/60',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-stone-100">
        <button
          type="button"
          onClick={goToPrevWeek}
          className="w-6.5 h-6.5 rounded-full hover:bg-stone-100 flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-stone-400" />
        </button>
        <span
          className={cn(
            'text-[11px] font-bold uppercase tracking-[0.09em]',
            isDragging ? 'text-primary' : 'text-stone-400',
          )}
        >
          {isDragging ? 'Drop on a day to schedule' : format(weekStart, 'MMM yyyy')}
        </span>
        <button
          type="button"
          onClick={goToNextWeek}
          className="w-6.5 h-6.5 rounded-full hover:bg-stone-100 flex items-center justify-center transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-stone-400" />
        </button>
      </div>

      {/* Days */}
      <div className="p-2 sm:p-2.5">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={format(weekStart, 'yyyy-MM-dd')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-4 sm:grid-cols-7 gap-2"
          >
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const dayMeals = mealsByDate.get(dateStr) ?? []
              const isTodayDate = isToday(day)
              const isSelected = isSameDay(day, selectedDate)
              const isHovered = isDragging && hoveredDate === dateStr

              return (
                <div
                  key={dateStr}
                  ref={(el) => setDayRef(dateStr, el)}
                  className={cn(
                    'rounded-xl border p-2 cursor-pointer transition-all flex flex-col min-h-[86px] sm:min-h-[92px]',
                    isHovered
                      ? 'border-primary/50 bg-primary/[0.06] ring-2 ring-primary/20 scale-[1.02]'
                      : isSelected
                        ? 'border-primary/40 bg-primary/[0.04]'
                        : 'border-stone-200/70 hover:bg-stone-50/70',
                  )}
                  onClick={() => onSelectDate(day)}
                >
                  {/* Day header */}
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col leading-tight">
                      <span
                        className={cn(
                          'text-[10px] uppercase tracking-wider',
                          isHovered
                            ? 'text-primary font-bold'
                            : isTodayDate
                              ? 'text-primary font-bold'
                              : 'text-stone-400',
                        )}
                      >
                        {format(day, 'EEE')}
                      </span>
                      <span
                        className={cn(
                          'text-[16px] font-semibold mt-0.5',
                          isHovered
                            ? 'text-primary'
                            : isTodayDate
                              ? 'text-primary'
                              : isSelected
                                ? 'text-[#1C1612]'
                                : 'text-stone-500',
                        )}
                      >
                        {format(day, 'd')}
                      </span>
                    </div>

                    {dayMeals.length > 0 && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">
                        {dayMeals.length}
                      </span>
                    )}
                  </div>

                  {/* Meal preview */}
                  <div className="mt-1.5 flex-1">
                    {dayMeals.length > 0 ? (
                      <div className="flex flex-col gap-1">
                        {dayMeals.map((meal) => (
                          <div
                            key={meal.id}
                            className="group/chip w-full min-h-6 px-2 py-1 rounded-lg border border-stone-200/70 bg-white text-left hover:border-stone-300 transition-colors flex items-start gap-1"
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                onSelectMeal(meal.id)
                              }}
                              className="flex-1 min-w-0"
                            >
                              <span className="text-[10px] font-medium text-stone-700 leading-[1.3] whitespace-normal break-words block">
                                {meal.name}
                              </span>
                            </button>
                            {onUnschedule && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onUnschedule(meal.id)
                                }}
                                className="shrink-0 p-0.5 rounded-full text-stone-300 opacity-0 group-hover/chip:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                              >
                                <CalendarX2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : isHovered ? (
                      <div className="h-6 flex items-center px-0.5">
                        <span className="text-[10px] text-primary font-medium">Drop here</span>
                      </div>
                    ) : (
                      <div className="h-6 flex items-center px-0.5">
                        <span className="text-[10px] text-stone-300 italic">No meals</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
