import { type ReactNode, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouterState } from '@tanstack/react-router'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { FABChatButton } from './FABChatButton'
import { PaywallDialog } from './PaywallDialog'
import { TrialExpiryBanner } from './TrialExpiryBanner'
import { ChatDrawer } from '@/features/chat/components/ChatDrawer'
import { useAuthStore } from '@/shared/stores/authStore'
import { useSubscriptionStore } from '@/shared/stores/subscriptionStore'
import { getSubscription } from '@/features/settings/subscriptionApi'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { location } = useRouterState()
  const isChat = location.pathname === '/chat'

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const setSubscription = useSubscriptionStore((s) => s.setSubscription)
  const subscriptionLoaded = useSubscriptionStore((s) => s.loaded)

  useEffect(() => {
    if (isAuthenticated && !subscriptionLoaded) {
      getSubscription()
        .then((sub) => {
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
        })
        .catch(() => {
          // Silently fail — subscription will be loaded when settings page is visited
        })
    }
  }, [isAuthenticated, subscriptionLoaded, setSubscription])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Right panel — `relative` anchors the chat overlay */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative">

        <TrialExpiryBanner />

        {/*
          Permanent flex-1 spacer with inner page slot.
          Because this div ALWAYS occupies flex-1, BottomNav is ALWAYS pinned
          to the bottom — even while the chat overlay is animating in/out.
          Regular pages live as `absolute inset-0` inside here so they never
          compete for flex space and can't cause layout shifts.
        */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          {!isChat && (
            <main
              key={location.pathname}
              className="absolute inset-0 overflow-y-auto"
            >
              {children}
            </main>
          )}
        </div>

        {/* BottomNav — always in flex flow, always at bottom */}
        <BottomNav />

        {/*
          Chat overlay in its own AnimatePresence, completely separate from
          page transitions. Absolute inset-0 z-40 covers the entire right
          panel (including BottomNav) while animating.
          When chat exits, the home/other page is already rendered below it,
          so the spring slide-down reveals content naturally.
        */}
        <AnimatePresence>
          {isChat && (
            <motion.div
              key="chat-overlay"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.85 }}
              className="absolute inset-0 z-40 bg-background overflow-hidden"
            >
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Desktop chat drawer */}
      <ChatDrawer />

      {/* Desktop FAB */}
      <FABChatButton />

      {/* Paywall dialog */}
      <PaywallDialog />
    </div>
  )
}
