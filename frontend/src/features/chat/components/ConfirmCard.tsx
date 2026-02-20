import { motion } from 'framer-motion'
import { CheckCircle, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import type { PendingActionResponse } from '@/shared/lib/api.types'

interface ConfirmCardProps {
  pendingAction: PendingActionResponse
  onConfirm: (confirm: boolean) => void
  confirmed?: 'yes' | 'no'
}

export function ConfirmCard({ pendingAction, onConfirm, confirmed }: ConfirmCardProps) {
  const { t } = useTranslation()

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="mt-1 rounded-xl border border-border bg-card p-3 w-full max-w-xs"
    >
      {pendingAction.confirmation_message && (
        <p className="text-sm text-foreground mb-3 leading-relaxed">
          {pendingAction.confirmation_message}
        </p>
      )}

      {pendingAction.items && pendingAction.items.length > 0 && (
        <div className="space-y-1 mb-3">
          {pendingAction.items.map((item, i) => (
            <div key={i} className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{item.intent}</span>
              {Object.entries(item.extracted_info).map(([k, v]) => (
                <span key={k}> · {String(v)}</span>
              ))}
            </div>
          ))}
        </div>
      )}

      {confirmed ? (
        <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1.5 rounded-lg w-fit ${
          confirmed === 'yes'
            ? 'bg-green-50 text-green-700'
            : 'bg-muted text-muted-foreground'
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
          <Button
            size="sm"
            className="flex-1 gap-1.5 h-8"
            onClick={() => onConfirm(true)}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {t('chat.confirmButton')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1.5 h-8"
            onClick={() => onConfirm(false)}
          >
            <XCircle className="w-3.5 h-3.5" />
            {t('chat.cancelButton')}
          </Button>
        </div>
      )}
    </motion.div>
  )
}
