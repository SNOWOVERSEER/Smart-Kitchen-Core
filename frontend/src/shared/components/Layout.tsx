import { type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouterState } from '@tanstack/react-router'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { FABChatButton } from './FABChatButton'
import { ChatDrawer } from '@/features/chat/components/ChatDrawer'

interface LayoutProps {
  children: ReactNode
}

export function Layout({ children }: LayoutProps) {
  const { location } = useRouterState()
  const isChat = location.pathname === '/chat'

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Right panel — `relative` anchors the chat overlay */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative">

        {/*
          Permanent flex-1 spacer with inner page slot.
          Because this div ALWAYS occupies flex-1, BottomNav is ALWAYS pinned
          to the bottom — even while the chat overlay is animating in/out.
          Regular pages live as `absolute inset-0` inside here so they never
          compete for flex space and can't cause layout shifts.
        */}
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <AnimatePresence mode="wait">
            {!isChat && (
              <motion.main
                key={location.pathname}
                initial={false}
                exit={{ opacity: 0 }}
                transition={{ duration: 0 }}
                className="absolute inset-0 overflow-y-auto"
              >
                {children}
              </motion.main>
            )}
          </AnimatePresence>
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
    </div>
  )
}
