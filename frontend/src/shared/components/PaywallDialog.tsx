import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'
import { Key, Heart, Gift, CreditCard } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/shared/stores/authStore'
import { useSubscriptionStore } from '@/shared/stores/subscriptionStore'
import { createCheckoutSession, buyCredits, redeemVoucher, getSubscription } from '@/features/settings/subscriptionApi'
import toast from 'react-hot-toast'

export function PaywallDialog() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [showRedeem, setShowRedeem] = useState(false)
  const [code, setCode] = useState('')
  const [redeeming, setRedeeming] = useState(false)
  const email = useAuthStore((s) => s.email)
  const tier = useSubscriptionStore((s) => s.tier)
  const setSubscription = useSubscriptionStore((s) => s.setSubscription)

  const handleShow = useCallback(() => {
    setOpen(true)
    setShowRedeem(false)
    setCode('')
  }, [])

  useEffect(() => {
    window.addEventListener('show-paywall', handleShow)
    return () => window.removeEventListener('show-paywall', handleShow)
  }, [handleShow])

  const handleUseOwnKey = () => {
    setOpen(false)
    void navigate({ to: '/settings' })
  }

  const handleSupport = async () => {
    try {
      const url = await createCheckoutSession(email ?? undefined)
      window.location.href = url
    } catch {
      toast.error(t('paywall.checkoutError'))
    }
  }

  const handleBuyCredits = async () => {
    try {
      const url = await buyCredits(email ?? undefined)
      window.location.href = url
    } catch {
      toast.error(t('paywall.checkoutError'))
    }
  }

  const handleRedeem = async () => {
    if (!code.trim()) return
    setRedeeming(true)
    try {
      const result = await redeemVoucher(code.trim())
      toast.success(result.message)
      // Refresh subscription state
      const sub = await getSubscription()
      setSubscription({
        tier: sub.tier,
        promptCredits: sub.prompt_credits,
        bonusCredits: sub.bonus_credits,
        totalCredits: sub.total_credits,
        hasApiKey: sub.has_api_key,
        trialEndsAt: sub.trial_ends_at,
        currentPeriodEnd: sub.current_period_end,
        paymentFailed: sub.payment_failed ?? false,
      })
      setOpen(false)
    } catch {
      toast.error(t('subscription.redeemError'))
    } finally {
      setRedeeming(false)
    }
  }

  const isSupporter = tier === 'supporter'

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isSupporter ? t('paywall.monthlyUsedUp') : t('paywall.title')}
          </DialogTitle>
          <DialogDescription>
            {isSupporter ? t('paywall.monthlyDescription') : t('paywall.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 mt-2">
          {!isSupporter && (
            <>
              <Button
                variant="outline"
                className="justify-start gap-3 h-auto py-3 px-4"
                onClick={handleUseOwnKey}
              >
                <Key className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium">{t('paywall.useOwnKey')}</p>
                  <p className="text-xs text-muted-foreground">{t('paywall.useOwnKeyDescription')}</p>
                </div>
              </Button>

              <Button
                variant="outline"
                className="justify-start gap-3 h-auto py-3 px-4"
                onClick={handleSupport}
              >
                <Heart className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-medium">{t('paywall.supportAuthor')}</p>
                  <p className="text-xs text-muted-foreground">{t('paywall.supportAuthorDescription')}</p>
                </div>
              </Button>
            </>
          )}

          <Button
            variant="outline"
            className="justify-start gap-3 h-auto py-3 px-4"
            onClick={handleBuyCredits}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <div className="text-left">
              <p className="text-sm font-medium">{t('subscription.buyCredits')}</p>
              <p className="text-xs text-muted-foreground">{t('subscription.buyCreditsDescription')}</p>
            </div>
          </Button>

          {!showRedeem ? (
            <Button
              variant="outline"
              className="justify-start gap-3 h-auto py-3 px-4"
              onClick={() => setShowRedeem(true)}
            >
              <Gift className="w-4 h-4 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium">{t('paywall.redeemCode')}</p>
              </div>
            </Button>
          ) : (
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t('subscription.redeemPlaceholder')}
                className="h-9"
                onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
              />
              <Button
                onClick={handleRedeem}
                disabled={!code.trim() || redeeming}
                className="h-9 shrink-0"
              >
                {t('subscription.redeem')}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
