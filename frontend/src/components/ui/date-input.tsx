import * as React from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
  isValid,
} from 'date-fns'
import { cn } from '@/lib/utils'

interface DateInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type' | 'onChange'> {
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void
  wrapperClassName?: string
  iconClassName?: string
  portal?: boolean
}

type PanelPosition = {
  top: number
  left: number
  width: number
}

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

function parseDate(value?: string | number | readonly string[] | null): Date | null {
  if (typeof value !== 'string' || !value) return null
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : null
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function toISODate(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export function DateInput({
  value,
  defaultValue,
  onChange,
  onBlur,
  onFocus,
  placeholder = 'Select date',
  className,
  wrapperClassName,
  iconClassName,
  portal = false,
  disabled,
  name,
  id,
  min,
  max,
  ...props
}: DateInputProps) {
  const isControlled = value !== undefined
  const [innerValue, setInnerValue] = React.useState(
    typeof defaultValue === 'string' ? defaultValue : '',
  )
  const currentValue = isControlled ? (typeof value === 'string' ? value : '') : innerValue

  const selectedDate = React.useMemo(() => parseDate(currentValue), [currentValue])
  const [open, setOpen] = React.useState(false)
  const [viewMonth, setViewMonth] = React.useState<Date>(selectedDate ?? new Date())
  const [panelPos, setPanelPos] = React.useState<PanelPosition>({ top: 0, left: 0, width: 320 })

  const triggerRef = React.useRef<HTMLButtonElement | null>(null)
  const panelRef = React.useRef<HTMLDivElement | null>(null)

  const minIso = typeof min === 'string' ? min : undefined
  const maxIso = typeof max === 'string' ? max : undefined

  const emitChange = React.useCallback(
    (nextValue: string) => {
      if (!isControlled) {
        setInnerValue(nextValue)
      }
      if (!onChange) return
      const target = {
        value: nextValue,
        name: name ?? '',
        id: id ?? '',
      } as HTMLInputElement
      onChange({ target, currentTarget: target } as React.ChangeEvent<HTMLInputElement>)
    },
    [id, isControlled, name, onChange],
  )

  const updatePanelPosition = React.useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const desiredWidth = clamp(rect.width, 304, 360)
    const width = Math.min(desiredWidth, window.innerWidth - 16)
    const left = clamp(rect.left, 8, window.innerWidth - width - 8)
    const panelHeight = 340
    const canOpenBelow = rect.bottom + 8 + panelHeight <= window.innerHeight - 8
    const top = canOpenBelow ? rect.bottom + 8 : Math.max(8, rect.top - panelHeight - 8)
    setPanelPos({ top, left, width })
  }, [])

  React.useEffect(() => {
    if (!open) return
    setViewMonth(selectedDate ?? new Date())
    updatePanelPosition()
  }, [open, selectedDate, updatePanelPosition])

  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      setOpen(false)
      if (onBlur && triggerRef.current) {
        onBlur({
          target: triggerRef.current as unknown as HTMLInputElement,
          currentTarget: triggerRef.current as unknown as HTMLInputElement,
        } as React.FocusEvent<HTMLInputElement>)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }
    const onReposition = () => updatePanelPosition()

    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onBlur, open, updatePanelPosition])

  const monthStart = React.useMemo(() => startOfMonth(viewMonth), [viewMonth])
  const monthEnd = React.useMemo(() => endOfMonth(viewMonth), [viewMonth])
  const gridStart = React.useMemo(
    () => startOfWeek(monthStart, { weekStartsOn: 1 }),
    [monthStart],
  )
  const gridEnd = React.useMemo(
    () => endOfWeek(monthEnd, { weekStartsOn: 1 }),
    [monthEnd],
  )

  const days = React.useMemo(() => {
    const all: Date[] = []
    for (let d = new Date(gridStart); d <= gridEnd; d.setDate(d.getDate() + 1)) {
      all.push(new Date(d))
    }
    return all
  }, [gridEnd, gridStart])

  const isDisabledDate = React.useCallback(
    (date: Date) => {
      const iso = toISODate(date)
      if (minIso && iso < minIso) return true
      if (maxIso && iso > maxIso) return true
      return false
    },
    [maxIso, minIso],
  )

  const handleSelectDate = (date: Date) => {
    if (isDisabledDate(date)) return
    emitChange(toISODate(date))
    setOpen(false)
  }

  const displayLabel = selectedDate ? format(selectedDate, 'MMM d, yyyy') : placeholder

  const calendarPanelContent = (
    <div
      ref={panelRef}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      className="fixed z-[140] rounded-2xl border border-stone-200 bg-[#FFFEF9] shadow-[0_20px_45px_-20px_rgba(28,22,18,0.45)] p-3"
      style={{ top: panelPos.top, left: panelPos.left, width: panelPos.width }}
    >
      <div className="flex items-center justify-between mb-2">
        <button
          type="button"
          onClick={() => setViewMonth((prev) => subMonths(prev, 1))}
          className="h-8 w-8 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4 mx-auto" />
        </button>
        <p className="text-sm font-semibold tracking-wide text-[#1C1612]">
          {format(viewMonth, 'MMMM yyyy')}
        </p>
        <button
          type="button"
          onClick={() => setViewMonth((prev) => addMonths(prev, 1))}
          className="h-8 w-8 rounded-lg text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4 mx-auto" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((label, idx) => (
          <span
            key={`${label}-${idx}`}
            className="h-7 text-[11px] font-semibold text-stone-400 flex items-center justify-center"
          >
            {label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const iso = toISODate(day)
          const selected = selectedDate ? isSameDay(day, selectedDate) : false
          const sameMonth = isSameMonth(day, viewMonth)
          const disabledDate = isDisabledDate(day)
          const today = isSameDay(day, new Date())

          return (
            <button
              key={iso}
              type="button"
              onClick={() => handleSelectDate(day)}
              disabled={disabledDate}
              className={cn(
                'h-9 rounded-lg text-sm transition-colors',
                selected
                  ? 'bg-primary text-white font-semibold shadow-sm shadow-primary/30'
                  : sameMonth
                    ? 'text-[#1C1612] hover:bg-stone-100'
                    : 'text-stone-300 hover:bg-stone-100',
                today && !selected && 'ring-1 ring-primary/40',
                disabledDate && 'opacity-35 cursor-not-allowed hover:bg-transparent',
              )}
            >
              {format(day, 'd')}
            </button>
          )
        })}
      </div>

      <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between">
        <button
          type="button"
          onClick={() => emitChange('')}
          className="h-8 px-2.5 rounded-lg text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-700 transition-colors"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => handleSelectDate(new Date())}
          className="h-8 px-2.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          Today
        </button>
      </div>
    </div>
  )

  const calendarPanel =
    open && portal && typeof document !== 'undefined'
      ? createPortal(calendarPanelContent, document.body)
      : open
        ? calendarPanelContent
        : null

  return (
    <>
      <div className={cn('relative', wrapperClassName)}>
        <button
          ref={triggerRef}
          type="button"
          id={id}
          name={name}
          disabled={disabled}
          onFocus={(event) => onFocus?.(event as unknown as React.FocusEvent<HTMLInputElement>)}
          onClick={() => {
            if (disabled) return
            setOpen((prev) => !prev)
          }}
          className={cn(
            'w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-left text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm',
            'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
            'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <span className={cn(selectedDate ? 'text-[#1C1612]' : 'text-stone-500')}>
            {displayLabel}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <CalendarDays className={cn('h-4 w-4 text-primary/70', iconClassName)} />
          </span>
        </button>
        <input type="hidden" value={currentValue} name={name} {...props} />
      </div>
      {calendarPanel}
    </>
  )
}
