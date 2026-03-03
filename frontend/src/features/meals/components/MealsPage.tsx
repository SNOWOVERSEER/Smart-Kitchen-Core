import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarDays,
  Plus,
  Loader2,
  GripVertical,
} from 'lucide-react'
import { parseISO, isBefore, startOfDay, format } from 'date-fns'
import { cn } from '@/lib/utils'
import { TopBar } from '@/shared/components/TopBar'
import { DesktopPageHeader } from '@/shared/components/DesktopPageHeader'
import { Button } from '@/components/ui/button'
import { useMeals, useCreateMeal, useUpdateMeal, useDeleteMeal } from '@/features/meals/hooks/useMeals'
import { MealDragProvider } from '@/features/meals/lib/MealDragContext'
import type { MealResponse } from '@/shared/lib/api.types'

import { MealCard } from './MealCard'
import { WeekCalendarStrip } from './WeekCalendarStrip'
import { CreateMealSheet } from './CreateMealSheet'
import { MealDetailOverlay } from './MealDetailOverlay'

// ---------------------------------------------------------------------------
// Section (list view)
// ---------------------------------------------------------------------------

interface SectionProps {
  label: string
  meals: MealResponse[]
  onSelect: (id: number) => void
  onUnschedule?: (id: number) => void
}

function Section({ label, meals, onSelect, onUnschedule }: SectionProps) {
  if (meals.length === 0) return null
  return (
    <div>
      <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400 mb-2 px-1">
        {label} ({meals.length})
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {meals.map((meal, i) => (
          <MealCard key={meal.id} meal={meal} onSelect={onSelect} index={i} onUnschedule={onUnschedule} />
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// MealsPage
// ---------------------------------------------------------------------------

export function MealsPage() {
  const { t } = useTranslation()
  const { data: meals, isLoading } = useMeals()
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedMealId, setSelectedMealId] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar')
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())

  const today = startOfDay(new Date())

  // Computed meal groups for list view
  const upcoming = useMemo(
    () =>
      (meals ?? [])
        .filter((m) => m.scheduled_date && !isBefore(parseISO(m.scheduled_date), today))
        .sort((a, b) => a.scheduled_date!.localeCompare(b.scheduled_date!)),
    [meals, today],
  )

  const unscheduled = useMemo(
    () =>
      (meals ?? [])
        .filter((m) => !m.scheduled_date)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [meals],
  )

  const past = useMemo(
    () =>
      (meals ?? [])
        .filter((m) => m.scheduled_date && isBefore(parseISO(m.scheduled_date), today))
        .sort((a, b) => b.scheduled_date!.localeCompare(a.scheduled_date!)),
    [meals, today],
  )

  // Computed data for calendar view
  const mealDates = useMemo(
    () => new Set((meals ?? []).filter((m) => m.scheduled_date).map((m) => m.scheduled_date!)),
    [meals],
  )

  const mealsForDate = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    return (meals ?? []).filter((m) => m.scheduled_date === dateStr)
  }, [meals, selectedDate])

  // All meals NOT on the selected date (for dragging to calendar)
  const otherMeals = useMemo(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd')
    return (meals ?? [])
      .filter((m) => m.scheduled_date !== dateStr)
      .sort((a, b) => {
        // Unscheduled first, then by date
        if (!a.scheduled_date && b.scheduled_date) return -1
        if (a.scheduled_date && !b.scheduled_date) return 1
        if (a.scheduled_date && b.scheduled_date) return a.scheduled_date.localeCompare(b.scheduled_date)
        return b.updated_at.localeCompare(a.updated_at)
      })
  }, [meals, selectedDate])

  const createMeal = useCreateMeal()
  const updateMeal = useUpdateMeal()
  const deleteMeal = useDeleteMeal()

  // Calendar view: delete the copy
  const handleUnscheduleDelete = useCallback(
    (mealId: number) => {
      deleteMeal.mutate(mealId)
    },
    [deleteMeal],
  )

  // List view: clear the date (move to Unscheduled)
  const handleUnscheduleClear = useCallback(
    (mealId: number) => {
      updateMeal.mutate({ id: mealId, data: { scheduled_date: null } })
    },
    [updateMeal],
  )

  const handleReschedule = useCallback(
    (mealId: number, newDate: string) => {
      const source = (meals ?? []).find((m) => m.id === mealId)
      if (!source) return
      // Prevent duplicate: same meal name + type on the same date
      const duplicate = (meals ?? []).find(
        (m) => m.scheduled_date === newDate && m.name === source.name && m.meal_type === source.meal_type,
      )
      if (duplicate) return
      createMeal.mutate({
        name: source.name,
        scheduled_date: newDate,
        meal_type: source.meal_type ?? undefined,
        notes: source.notes ?? undefined,
        recipe_ids: source.recipes.map((r) => r.recipe_id),
      })
      setSelectedDate(parseISO(newDate))
    },
    [meals, createMeal],
  )

  const hasMeals = (meals ?? []).length > 0

  // View toggle component (reused in mobile + desktop)
  const viewToggle = (
    <div className="flex gap-1 bg-stone-200/60 rounded-xl p-1 mx-4 sm:mx-5 lg:mx-0">
      {(['calendar', 'list'] as const).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => setViewMode(mode)}
          className={cn(
            'flex-1 text-xs font-medium py-1.5 rounded-lg transition-all',
            viewMode === mode
              ? 'bg-white shadow-sm text-[#1C1612]'
              : 'text-stone-500 hover:text-stone-700',
          )}
        >
          {t(`meals.${mode}View`)}
        </button>
      ))}
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-[#FAF6F1]">
      {/* Mobile TopBar */}
      <TopBar
        title={t('meals.title', 'Meals')}
        mobileIcon={CalendarDays}
        className="lg:hidden"
        extraActions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="w-11 h-11 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="w-[18px] h-[18px]" />
          </button>
        }
      />

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Desktop header */}
        <div className="hidden lg:block px-6 pt-6">
          <DesktopPageHeader
            icon={CalendarDays}
            title={t('meals.title', 'Meals')}
            rightSlot={
              <div className="flex items-center gap-3">
                <div className="flex gap-1 bg-stone-200/60 rounded-xl p-1">
                  {(['calendar', 'list'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setViewMode(mode)}
                      className={cn(
                        'text-xs font-medium px-3 py-1.5 rounded-lg transition-all',
                        viewMode === mode
                          ? 'bg-white shadow-sm text-[#1C1612]'
                          : 'text-stone-500 hover:text-stone-700',
                      )}
                    >
                      {t(`meals.${mode}View`)}
                    </button>
                  ))}
                </div>
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  {t('meals.createMeal', 'Create meal')}
                </Button>
              </div>
            }
          />
        </div>

        {/* Mobile hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="lg:hidden px-4 sm:px-5 pt-5 pb-3"
        >
          <h1
            className="text-[clamp(1.45rem,5.5vw,1.85rem)] leading-[1.06] tracking-[-0.01em] text-[#1C1612]"
            style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
          >
            {t('meals.heroTitle', 'Meal Plan')}
          </h1>
          <p className="mt-1.5 text-sm text-stone-500 leading-snug">
            {t('meals.heroSub', 'Organize your meals for the week')}
          </p>
          <div className="mt-2.5 h-px w-18 rounded-full bg-gradient-to-r from-primary/55 via-primary/25 to-transparent" />
        </motion.div>

        {/* Mobile view toggle */}
        <div className="lg:hidden mb-4">{viewToggle}</div>

        {/* Main content */}
        <div className="px-4 sm:px-5 lg:px-6 pb-24 lg:pb-8">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !hasMeals ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center justify-center py-16 px-8 text-center gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-center justify-center">
                <CalendarDays className="w-7 h-7 text-stone-300" />
              </div>
              <div>
                <p className="text-sm font-semibold text-stone-600">
                  {t('meals.noMeals', 'No meals yet')}
                </p>
                <p className="text-xs text-stone-400 mt-1">
                  {t('meals.noMealsSub', 'Create a meal to start planning')}
                </p>
              </div>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" />
                {t('meals.createMeal', 'Create meal')}
              </Button>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              {viewMode === 'calendar' ? (
                <motion.div
                  key="calendar"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                >
                  <MealDragProvider>
                    {/* Week calendar strip */}
                    <WeekCalendarStrip
                      selectedDate={selectedDate}
                      onSelectDate={setSelectedDate}
                      mealDates={mealDates}
                      className="mb-5"
                    />

                    {/* Meals for selected date */}
                    <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400 mb-2 px-1">
                      {t('meals.mealsForDate', { date: format(selectedDate, 'MMM d') })} ({mealsForDate.length})
                    </p>

                    {mealsForDate.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {mealsForDate.map((meal, i) => (
                          <MealCard
                            key={meal.id}
                            meal={meal}
                            onSelect={setSelectedMealId}
                            index={i}
                            enableDrag
                            onReschedule={handleReschedule}
                            onUnschedule={handleUnscheduleDelete}
                          />
                        ))}
                      </div>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="flex flex-col items-center justify-center py-12 px-8 text-center gap-3"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-center justify-center">
                          <CalendarDays className="w-6 h-6 text-stone-300" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-stone-600">
                            {t('meals.noMealsForDate', 'No meals planned')}
                          </p>
                          <p className="text-xs text-stone-400 mt-1">
                            {t('meals.noMealsForDateSub', 'Tap + to plan a meal for this day')}
                          </p>
                        </div>
                      </motion.div>
                    )}

                    {/* Other meals — available for drag-to-reschedule */}
                    {otherMeals.length > 0 && (
                      <div className="mt-6">
                        <div className="flex items-center gap-2 mb-2 px-1">
                          <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400">
                            {t('meals.otherMeals', 'Other meals')} ({otherMeals.length})
                          </p>
                          <span className="flex items-center gap-1 text-[10px] text-stone-400/70">
                            <GripVertical className="w-3 h-3" />
                            {t('meals.dragHint', 'Hold & drag to calendar to reschedule')}
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {otherMeals.map((meal, i) => (
                            <MealCard
                              key={meal.id}
                              meal={meal}
                              onSelect={setSelectedMealId}
                              index={i}
                              enableDrag
                              onReschedule={handleReschedule}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </MealDragProvider>
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="flex flex-col gap-6">
                    <Section
                      label={t('meals.upcoming', 'Upcoming')}
                      meals={upcoming}
                      onSelect={setSelectedMealId}
                      onUnschedule={handleUnscheduleClear}
                    />
                    <Section
                      label={t('meals.unscheduled', 'Unscheduled')}
                      meals={unscheduled}
                      onSelect={setSelectedMealId}
                    />
                    <Section
                      label={t('meals.past', 'Past')}
                      meals={past}
                      onSelect={setSelectedMealId}
                      onUnschedule={handleUnscheduleClear}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Mobile FAB */}
      {hasMeals && (
        <motion.button
          type="button"
          onClick={() => setCreateOpen(true)}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="lg:hidden fixed right-4 z-20 w-14 h-14 rounded-2xl bg-[#1C1612] text-white shadow-lg flex items-center justify-center"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + clamp(5rem, 9vh, 7rem))' }}
        >
          <Plus className="w-6 h-6" />
        </motion.button>
      )}

      {/* Sheets */}
      <CreateMealSheet open={createOpen} onClose={() => setCreateOpen(false)} />
      <MealDetailOverlay
        mealId={selectedMealId}
        open={selectedMealId !== null}
        onClose={() => setSelectedMealId(null)}
      />
    </div>
  )
}
