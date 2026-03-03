import { useState, useMemo, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CalendarDays,
  Plus,
  Loader2,
  GripVertical,
  LayoutList,
} from 'lucide-react'
import { parseISO, isBefore, isAfter, startOfDay, startOfWeek, addDays, subDays, format } from 'date-fns'
import { cn } from '@/lib/utils'
import { TopBar } from '@/shared/components/TopBar'
import { DesktopPageHeader } from '@/shared/components/DesktopPageHeader'
import { Button } from '@/components/ui/button'
import { useMeals, useCreateMeal, useUpdateMeal, useDeleteMeal } from '@/features/meals/hooks/useMeals'
import { MealDragProvider } from '@/features/meals/lib/MealDragContext'
import type { MealResponse } from '@/shared/lib/api.types'

import { MealCard } from './MealCard'
import { WeekCalendarStrip } from './WeekCalendarStrip'
import { WeekScheduleView } from './WeekScheduleView'
import { CreateMealSheet } from './CreateMealSheet'
import { MealDetailOverlay } from './MealDetailOverlay'

// ---------------------------------------------------------------------------
// Date filter helper
// ---------------------------------------------------------------------------

type DateFilterKey = 'all' | 'last7' | 'last30' | 'next7' | 'next30'

function matchesDateFilter(d: Date, filter: DateFilterKey, today: Date): boolean {
  switch (filter) {
    case 'last7': return isAfter(d, subDays(today, 7)) && !isAfter(d, today)
    case 'last30': return isAfter(d, subDays(today, 30)) && !isAfter(d, today)
    case 'next7': return !isBefore(d, today) && isBefore(d, addDays(today, 8))
    case 'next30': return !isBefore(d, today) && isBefore(d, addDays(today, 31))
    default: return true
  }
}

// ---------------------------------------------------------------------------
// DateFilterChips
// ---------------------------------------------------------------------------

function DateFilterChips({
  filters,
  active,
  onChange,
  className,
}: {
  filters: { key: DateFilterKey; label: string }[]
  active: DateFilterKey
  onChange: (key: DateFilterKey) => void
  className?: string
}) {
  return (
    <div className={cn('flex gap-1.5 overflow-x-auto scrollbar-hide', className)}>
      {filters.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onChange(f.key)}
          className={cn(
            'shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all',
            active === f.key
              ? 'bg-[#1C1612] text-white shadow-sm'
              : 'bg-white border border-stone-200/80 text-stone-500 hover:text-stone-700 hover:border-stone-300',
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}

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
  const [dateFilter, setDateFilter] = useState<DateFilterKey>('all')
  const [calendarExpanded, setCalendarExpanded] = useState(false)
  const otherMealsRef = useRef<HTMLDivElement>(null)

  const today = startOfDay(new Date())

  const dateFilters: { key: DateFilterKey; label: string }[] = [
    { key: 'all', label: t('meals.filterAll', 'All') },
    { key: 'last7', label: t('meals.filterLast7', 'Last 7d') },
    { key: 'last30', label: t('meals.filterLast30', 'Last 30d') },
    { key: 'next7', label: t('meals.filterNext7', 'Next 7d') },
    { key: 'next30', label: t('meals.filterNext30', 'Next 30d') },
  ]

  // Filtered meals for list view
  const filteredMeals = useMemo(() => {
    const all = meals ?? []
    if (dateFilter === 'all') return all
    return all.filter((m) => {
      if (!m.scheduled_date) return false
      return matchesDateFilter(parseISO(m.scheduled_date), dateFilter, today)
    })
  }, [meals, dateFilter, today])

  // Group filtered meals into sections (list view)
  const upcoming = useMemo(
    () =>
      filteredMeals
        .filter((m) => m.scheduled_date && !isBefore(parseISO(m.scheduled_date), today))
        .sort((a, b) => a.scheduled_date!.localeCompare(b.scheduled_date!)),
    [filteredMeals, today],
  )

  const unscheduled = useMemo(
    () =>
      filteredMeals
        .filter((m) => !m.scheduled_date)
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at)),
    [filteredMeals],
  )

  const past = useMemo(
    () =>
      filteredMeals
        .filter((m) => m.scheduled_date && isBefore(parseISO(m.scheduled_date), today))
        .sort((a, b) => b.scheduled_date!.localeCompare(a.scheduled_date!)),
    [filteredMeals, today],
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

  // "Other meals" — excluded dates depend on compact vs expanded mode
  const otherMeals = useMemo(() => {
    const all = meals ?? []

    // Build set of dates already visible in the calendar area
    let displayedDates: Set<string>
    if (calendarExpanded) {
      const ws = startOfWeek(selectedDate, { weekStartsOn: 1 })
      displayedDates = new Set(
        Array.from({ length: 7 }, (_, i) => format(addDays(ws, i), 'yyyy-MM-dd')),
      )
    } else {
      displayedDates = new Set([format(selectedDate, 'yyyy-MM-dd')])
    }

    const base = all.filter((m) => !m.scheduled_date || !displayedDates.has(m.scheduled_date))

    const filtered =
      dateFilter === 'all'
        ? base
        : base.filter((m) => {
            if (!m.scheduled_date) return false
            return matchesDateFilter(parseISO(m.scheduled_date), dateFilter, today)
          })

    return filtered.sort((a, b) => {
      if (!a.scheduled_date && b.scheduled_date) return -1
      if (a.scheduled_date && !b.scheduled_date) return 1
      if (a.scheduled_date && b.scheduled_date) return a.scheduled_date.localeCompare(b.scheduled_date)
      return b.updated_at.localeCompare(a.updated_at)
    })
  }, [meals, selectedDate, calendarExpanded, dateFilter, today])

  const createMeal = useCreateMeal()
  const updateMeal = useUpdateMeal()
  const deleteMeal = useDeleteMeal()

  const handleUnscheduleDelete = useCallback(
    (mealId: number) => deleteMeal.mutate(mealId),
    [deleteMeal],
  )

  const handleUnscheduleClear = useCallback(
    (mealId: number) => updateMeal.mutate({ id: mealId, data: { scheduled_date: null } }),
    [updateMeal],
  )

  const handleReschedule = useCallback(
    (mealId: number, newDate: string) => {
      const source = (meals ?? []).find((m) => m.id === mealId)
      if (!source) return
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

  // Prevent outer scroll when scrolling inside the other-meals panel
  const handleOuterWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (viewMode !== 'calendar') return
      const panel = otherMealsRef.current
      if (!panel) return
      // Check if the wheel event target is inside the other-meals scroll area
      if (panel.contains(e.target as Node)) {
        // Already scrolling inside the panel — let it handle naturally
        return
      }
      // If scrolling would go past the calendar area into other-meals,
      // redirect scroll to the panel instead
      const panelRect = panel.getBoundingClientRect()
      const scrollerRect = e.currentTarget.getBoundingClientRect()
      const panelTop = panelRect.top - scrollerRect.top + e.currentTarget.scrollTop
      if (e.currentTarget.scrollTop >= panelTop - 2 && e.deltaY > 0) {
        e.preventDefault()
        panel.scrollTop += e.deltaY
      }
    },
    [viewMode],
  )

  // View toggle component
  const viewToggle = (
    <div className="flex gap-1 bg-stone-200/60 rounded-xl p-1">
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

  // Expand/collapse toggle for calendar mode
  const expandToggle = (
    <button
      type="button"
      onClick={() => setCalendarExpanded((prev) => !prev)}
      className={cn(
        'p-1.5 rounded-lg transition-colors',
        calendarExpanded
          ? 'bg-[#1C1612] text-white'
          : 'text-stone-400 hover:text-stone-600 hover:bg-stone-100',
      )}
      title={calendarExpanded ? t('meals.compactView', 'Compact') : t('meals.scheduleView', 'Schedule')}
    >
      <LayoutList className="w-3.5 h-3.5" />
    </button>
  )

  // ---------- Other meals section (shared between compact & expanded) ----------
  const otherMealsSection = (
    <div>
      <div className="flex items-center gap-2 mb-2 px-1">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.09em] text-stone-400">
          {t('meals.otherMeals', 'Other meals')} ({otherMeals.length})
        </p>
        {!calendarExpanded && (
          <span className="flex items-center gap-1 text-[10px] text-stone-400/70">
            <GripVertical className="w-3 h-3" />
            {t('meals.dragHint', 'Drag to calendar to reschedule')}
          </span>
        )}
      </div>

      <DateFilterChips
        filters={dateFilters}
        active={dateFilter}
        onChange={setDateFilter}
        className="pb-3"
      />

      {otherMeals.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {otherMeals.map((meal, i) => (
            <MealCard
              key={meal.id}
              meal={meal}
              onSelect={setSelectedMealId}
              index={i}
              enableDrag={!calendarExpanded}
              onReschedule={!calendarExpanded ? handleReschedule : undefined}
            />
          ))}
        </div>
      ) : dateFilter !== 'all' ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center py-8 text-center gap-2"
        >
          <CalendarDays className="w-7 h-7 text-stone-300" />
          <p className="text-xs text-stone-400">{t('meals.noMealsForDate', 'No meals found')}</p>
        </motion.div>
      ) : null}
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
      <div className="flex-1 overflow-y-auto" onWheel={handleOuterWheel}>
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
                {viewMode === 'calendar' && expandToggle}
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

        {/* Mobile view toggle + expand toggle */}
        <div className="lg:hidden mb-4 flex items-center gap-2 px-4 sm:px-5">
          <div className="flex-1">{viewToggle}</div>
          {viewMode === 'calendar' && expandToggle}
        </div>

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
                  className="flex flex-col"
                >
                  <MealDragProvider>
                    {/* ---- Sticky calendar area ---- */}
                    <div className="sticky top-0 z-10 bg-[#FAF6F1] -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 pt-1 pb-3">
                      <AnimatePresence mode="wait" initial={false}>
                        {calendarExpanded ? (
                          <motion.div
                            key="expanded"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <WeekScheduleView
                              selectedDate={selectedDate}
                              onSelectDate={setSelectedDate}
                              meals={meals ?? []}
                              onSelectMeal={setSelectedMealId}
                            />
                          </motion.div>
                        ) : (
                          <motion.div
                            key="compact"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            <WeekCalendarStrip
                              selectedDate={selectedDate}
                              onSelectDate={setSelectedDate}
                              mealDates={mealDates}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* ---- Compact: meals for selected date ---- */}
                    {!calendarExpanded && (
                      <div className="mt-2 mb-4">
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
                            className="flex flex-col items-center justify-center py-10 px-8 text-center gap-3"
                          >
                            <div className="w-12 h-12 rounded-2xl bg-white border border-stone-200 shadow-sm flex items-center justify-center">
                              <CalendarDays className="w-5 h-5 text-stone-300" />
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
                      </div>
                    )}

                    {/* ---- Other meals (independently scrollable) ---- */}
                    <div
                      ref={otherMealsRef}
                      className="mt-2 max-h-[50vh] overflow-y-auto rounded-xl"
                    >
                      {otherMealsSection}
                    </div>
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
                  <DateFilterChips
                    filters={dateFilters}
                    active={dateFilter}
                    onChange={setDateFilter}
                    className="pb-4"
                  />

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

                    {upcoming.length === 0 && unscheduled.length === 0 && past.length === 0 && dateFilter !== 'all' && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center py-12 text-center gap-2"
                      >
                        <CalendarDays className="w-8 h-8 text-stone-300" />
                        <p className="text-sm text-stone-500">{t('meals.noMealsForDate', 'No meals found')}</p>
                      </motion.div>
                    )}
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
