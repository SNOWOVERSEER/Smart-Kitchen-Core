import { Bot } from 'lucide-react'
import { motion } from 'framer-motion'
import { useChatStore } from '@/features/chat/store'
import { useIsDesktop } from '../hooks/useMediaQuery'

export function FABChatButton() {
  const isDesktop = useIsDesktop()
  const { isOpen, open } = useChatStore()

  if (!isDesktop || isOpen) return null

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileTap={{ scale: 0.94 }}
      onClick={open}
      className="fixed bottom-6 right-6 w-14 h-14 bg-foreground text-background rounded-full shadow-lg flex items-center justify-center z-40 hover:bg-foreground/90 transition-colors"
      aria-label="Open agent chat"
    >
      <Bot className="w-6 h-6" />
    </motion.button>
  )
}
