import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'

interface DayRect {
  dateKey: string
  rect: DOMRect
}

interface MealDragContextValue {
  draggedMealId: number | null
  hoveredDate: string | null
  startDrag: (mealId: number) => void
  endDrag: () => void
  /** Called by WeekCalendarStrip to register day cell positions */
  registerDayRects: (rects: DayRect[]) => void
  /** Called by MealCard during drag to hit-test pointer against day cells */
  hitTestPointer: (x: number, y: number) => void
}

const MealDragContext = createContext<MealDragContextValue | null>(null)

interface MealDragProviderProps {
  children: ReactNode
  onDragActiveChange?: (active: boolean) => void
}

export function MealDragProvider({ children, onDragActiveChange }: MealDragProviderProps) {
  const [draggedMealId, setDraggedMealId] = useState<number | null>(null)
  const [hoveredDate, setHoveredDate] = useState<string | null>(null)
  const dayRectsRef = useRef<DayRect[]>([])
  const onDragActiveChangeRef = useRef(onDragActiveChange)
  onDragActiveChangeRef.current = onDragActiveChange

  const startDrag = useCallback((mealId: number) => {
    setDraggedMealId(mealId)
    onDragActiveChangeRef.current?.(true)
  }, [])
  const endDrag = useCallback(() => {
    setDraggedMealId(null)
    setHoveredDate(null)
    onDragActiveChangeRef.current?.(false)
  }, [])

  const registerDayRects = useCallback((rects: DayRect[]) => {
    dayRectsRef.current = rects
  }, [])

  const hitTestPointer = useCallback((x: number, y: number) => {
    const hit = dayRectsRef.current.find(
      (d) => x >= d.rect.left && x <= d.rect.right && y >= d.rect.top && y <= d.rect.bottom,
    )
    setHoveredDate(hit?.dateKey ?? null)
  }, [])

  return (
    <MealDragContext.Provider
      value={{ draggedMealId, hoveredDate, startDrag, endDrag, registerDayRects, hitTestPointer }}
    >
      {children}
    </MealDragContext.Provider>
  )
}

export function useMealDrag() {
  const ctx = useContext(MealDragContext)
  if (!ctx) throw new Error('useMealDrag must be used within MealDragProvider')
  return ctx
}

/**
 * Optional hook that returns null when used outside a MealDragProvider.
 * Useful for components that may render in both drag-enabled and non-drag contexts.
 */
export function useMealDragOptional(): MealDragContextValue | null {
  return useContext(MealDragContext)
}
