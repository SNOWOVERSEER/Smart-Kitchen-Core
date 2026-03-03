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
import { MEAL_TYPE_CONFIG } from '../lib/mealConstants'
import type { MealType } from '../lib/mealConstants'
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

  const goToPrevWeek = () => onSelectDate(addDays(selectedDate, -7))
  const goToNextWeek = () => onSelectDate(addDays(selectedDate, 7))

  return (
    <div
      className={cn(
        'bg-white rounded-2xl border border-stone-200/60 shadow-[0_2px_12px_-4px_rgba(28,22,18,0.08)] overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100">
        <button
          type="button"
          onClick={goToPrevWeek}
          className="w-7 h-7 rounded-full hover:bg-stone-100 flex items-center justify-center transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-stone-400" />
        </button>
        <span className="text-[11px] font-bold uppercase tracking-[0.09em] text-stone-400">
          {format(weekStart, 'MMM yyyy')}
        </span>
        <button
          type="button"
          onClick={goToNextWeek}
          className="w-7 h-7 rounded-full hover:bg-stone-100 flex items-center justify-center transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-stone-400" />
        </button>
      </div>

      {/* Days */}
      <div className="divide-y divide-stone-100">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={format(weekStart, 'yyyy-MM-dd')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="divide-y divide-stone-100"
          >
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd')
              const dayMeals = mealsByDate.get(dateStr) ?? []
              const isTodayDate = isToday(day)
              const isSelected = isSameDay(day, selectedDate)

              return (
                <div
                  key={dateStr}
                  className={cn(
                    'flex gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-stone-50/60',
                    isSelected && 'bg-primary/[0.03]',
                  )}
                  onClick={() => onSelectDate(day)}
                >
                  {/* Day label */}
                  <div className="w-10 shrink-0 flex flex-col items-center pt-0.5">
                    <span
                      className={cn(
                        'text-[10px] uppercase tracking-wider leading-tight',
                        isTodayDate ? 'text-primary font-bold' : 'text-stone-400',
                      )}
                    >
                      {format(day, 'EEE').slice(0, 3)}
                    </span>
                    <span
                      className={cn(
                        'text-[17px] font-semibold leading-tight',
                        isTodayDate
                          ? 'text-primary'
                          : isSelected
                            ? 'text-[#1C1612]'
                            : 'text-stone-500',
                      )}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>

                  {/* Meal chips */}
                  <div className="flex-1 flex flex-col gap-1 min-h-[2rem] justify-center">
                    {dayMeals.length > 0 ? (
                      dayMeals.map((meal) => {
                        const mt = meal.meal_type as MealType | null
                        const config = mt ? MEAL_TYPE_CONFIG[mt] : null
                        return (
                          <button
                            key={meal.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onSelectMeal(meal.id)
                            }}
                            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-stone-200/60 hover:border-stone-300 shadow-[0_1px_3px_-1px_rgba(28,22,18,0.05)] text-left transition-colors bg-white"
                          >
                            <div
                              className={cn(
                                'w-1 self-stretch rounded-full shrink-0',
                                config
                                  ? `bg-gradient-to-b ${config.gradient}`
                                  : 'bg-stone-300',
                              )}
                            />
                            <div className="flex-1 min-w-0">
                              <span className="text-xs font-medium text-stone-700 truncate block">
                                {meal.name}
                              </span>
                              {meal.recipes.length > 0 && (
                                <span className="text-[10px] text-stone-400 truncate block">
                                  {meal.recipes
                                    .slice(0, 2)
                                    .map((r) => r.title)
                                    .join(', ')}
                                </span>
                              )}
                            </div>
                            {mt && config && (
                              <span
                                className={cn(
                                  'text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0',
                                  config.bgLight,
                                  config.textColor,
                                )}
                              >
                                {mt.slice(0, 3)}
                              </span>
                            )}
                          </button>
                        )
                      })
                    ) : (
                      <span className="text-[11px] text-stone-300 italic">—</span>
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
