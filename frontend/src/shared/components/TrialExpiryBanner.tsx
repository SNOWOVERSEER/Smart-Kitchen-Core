import { useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSubscriptionStore } from '@/shared/stores/subscriptionStore'

export function TrialExpiryBanner() {
  const { t } = useTranslation()
  const { tier, trialEndsAt, totalCredits, loaded } = useSubscriptionStore()
  const [dismissed, setDismissed] = useState(false)

  if (!loaded || dismissed || tier === 'byok' || tier === 'supporter') return null

  if (trialEndsAt) {
    const daysLeft = Math.ceil(
      (new Date(trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    if (daysLeft > 3 || daysLeft < 0) return null

    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
        <span className="text-amber-800">
          {t('subscription.trialExpiryWarning', { days: daysLeft })}
        </span>
        <button onClick={() => setDismissed(true)} className="text-amber-600 hover:text-amber-800 cursor-pointer ml-4 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  if (totalCredits > 0 && totalCredits <= 3) {
    return (
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between text-sm">
        <span className="text-amber-800">
          {t('subscription.lowCreditsWarning', { count: totalCredits })}
        </span>
        <button onClick={() => setDismissed(true)} className="text-amber-600 hover:text-amber-800 cursor-pointer ml-4 shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return null
}
