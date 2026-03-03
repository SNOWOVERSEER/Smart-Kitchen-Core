import { motion } from 'framer-motion'
import {
  CheckCircle,
  XCircle,
  PackagePlus,
  Utensils,
  Trash2,
  RefreshCw,
  CalendarPlus,
  ShoppingCart,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { PendingActionResponse } from '@/shared/lib/api.types'

interface ConfirmCardProps {
  pendingAction: PendingActionResponse
  onConfirm: (confirm: boolean) => void
  confirmed?: 'yes' | 'no'
}

const INTENT_CONFIG: Record<string, { icon: LucideIcon; color: string; bg: string }> = {
  ADD: { icon: PackagePlus, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  CONSUME: { icon: Utensils, color: 'text-blue-600', bg: 'bg-blue-50' },
  DISCARD: { icon: Trash2, color: 'text-red-500', bg: 'bg-red-50' },
  UPDATE: { icon: RefreshCw, color: 'text-amber-600', bg: 'bg-amber-50' },
  CREATE_MEAL: { icon: CalendarPlus, color: 'text-violet-600', bg: 'bg-violet-50' },
  ADD_TO_SHOPPING_LIST: { icon: ShoppingCart, color: 'text-teal-600', bg: 'bg-teal-50' },
}

function getIntentConfig(intent: string) {
  return INTENT_CONFIG[intent] ?? { icon: Zap, color: 'text-stone-600', bg: 'bg-stone-50' }
}

function formatValue(key: string, value: unknown): string | null {
  if (value == null || value === '') return null
  if (key === 'batch_id' || key === 'recipe_ids') return null
  return String(value)
}

export function ConfirmCard({ pendingAction, onConfirm, confirmed }: ConfirmCardProps) {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      className="w-full max-w-xs rounded-2xl border border-stone-200/60 bg-white shadow-[0_2px_12px_-4px_rgba(28,22,18,0.08)] overflow-hidden"
    >
      {/* Items */}
      {pendingAction.items && pendingAction.items.length > 0 && (
        <div className="px-3.5 pt-3 pb-2 space-y-2">
          {pendingAction.items.map((item, i) => {
            const config = getIntentConfig(item.intent)
            const Icon = config.icon
            const intentKey = `chat.intent${item.intent}`
            const label = t(intentKey, t('chat.intentDEFAULT'))

            return (
              <div key={i} className="flex items-start gap-2.5">
                <div className={`w-7 h-7 rounded-lg ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-stone-700">{label}</p>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                    {Object.entries(item.extracted_info).map(([k, v]) => {
                      const formatted = formatValue(k, v)
                      if (!formatted) return null
                      return (
                        <span key={k} className="text-[11px] text-stone-500">
                          <span className="text-stone-400">{k.replace(/_/g, ' ')}:</span>{' '}
                          <span className="text-stone-600 font-medium">{formatted}</span>
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Divider + actions */}
      <div className="border-t border-stone-100 px-3.5 py-2.5">
        {confirmed ? (
          <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg w-fit ${
            confirmed === 'yes'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-stone-100 text-stone-500'
          }`}>
            {confirmed === 'yes' ? (
              <>
                <CheckCircle className="w-3.5 h-3.5" />
                {t('chat.confirmed')}
              </>
            ) : (
              <>
                <XCircle className="w-3.5 h-3.5" />
                {t('chat.cancelled')}
              </>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => onConfirm(true)}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl bg-[#1C1612] text-white text-xs font-medium hover:bg-[#1C1612]/90 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {t('chat.confirmButton')}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => onConfirm(false)}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-xl border border-stone-200 text-stone-600 text-xs font-medium hover:bg-stone-50 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              {t('chat.cancelButton')}
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
