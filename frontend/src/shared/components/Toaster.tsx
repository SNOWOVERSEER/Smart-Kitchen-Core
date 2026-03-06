import { useCallback, useEffect, useRef } from 'react'
import {
  toast,
  useToaster,
  type Toast,
} from 'react-hot-toast'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, XCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const MAX_VISIBLE = 3

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  blank: Info,
  custom: Info,
  loading: Info,
} as const

const ACCENT = {
  success: {
    icon: 'text-emerald-500',
    bar: 'bg-emerald-500',
    bg: 'bg-emerald-50/60',
  },
  error: {
    icon: 'text-red-500',
    bar: 'bg-red-500',
    bg: 'bg-red-50/60',
  },
  blank: {
    icon: 'text-stone-400',
    bar: 'bg-stone-400',
    bg: 'bg-stone-50/60',
  },
  custom: {
    icon: 'text-stone-400',
    bar: 'bg-stone-400',
    bg: 'bg-stone-50/60',
  },
  loading: {
    icon: 'text-stone-400',
    bar: 'bg-stone-400',
    bg: 'bg-stone-50/60',
  },
} as const

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const

function ToastItem({ t: td, onDismiss }: { t: Toast; onDismiss: (id: string) => void }) {
  const Icon = ICONS[td.type] ?? Info
  const accent = ACCENT[td.type] ?? ACCENT.blank
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const pausedRef = useRef(false)

  // Auto-dismiss with pause support
  useEffect(() => {
    if (!td.visible) return
    const dur = td.duration ?? 2500
    timerRef.current = setTimeout(() => {
      if (!pausedRef.current) onDismiss(td.id)
    }, dur)
    return () => clearTimeout(timerRef.current)
  }, [td.id, td.visible, td.duration, onDismiss])

  const handleMouseEnter = () => {
    pausedRef.current = true
    clearTimeout(timerRef.current)
  }

  const handleMouseLeave = () => {
    pausedRef.current = false
    timerRef.current = setTimeout(() => onDismiss(td.id), 1000)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92, transition: { duration: 0.15 } }}
      transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        'relative flex items-center gap-2.5 pl-4 pr-2.5 py-2.5 rounded-2xl shadow-lg border overflow-hidden max-w-[340px]',
        'bg-white/95 backdrop-blur-xl border-stone-200/60',
      )}
    >
      {/* Left accent bar */}
      <div className={cn('absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl', accent.bar)} />

      {/* Icon */}
      <div className={cn('shrink-0 w-7 h-7 rounded-lg flex items-center justify-center', accent.bg)}>
        <Icon className={cn('w-4 h-4', accent.icon)} />
      </div>

      {/* Message */}
      <p className="flex-1 text-[13px] font-medium text-[#1C1612] leading-snug">
        {typeof td.message === 'function' ? td.message(td) : td.message}
      </p>

      {/* Dismiss */}
      <button
        type="button"
        onClick={() => onDismiss(td.id)}
        className="shrink-0 p-1 rounded-lg text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  )
}

export function Toaster() {
  const { toasts } = useToaster()

  // Dismiss overflow toasts immediately
  const visible = toasts.filter((t) => t.visible)
  useEffect(() => {
    visible.slice(MAX_VISIBLE).forEach((t) => toast.dismiss(t.id))
  }, [visible])

  const handleDismiss = useCallback((id: string) => toast.dismiss(id), [])

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] flex flex-col items-center gap-2 pointer-events-none"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 80px)' }}
    >
      <AnimatePresence mode="popLayout">
        {visible.slice(0, MAX_VISIBLE).map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItem t={t} onDismiss={handleDismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  )
}
