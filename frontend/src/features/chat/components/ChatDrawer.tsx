import { motion, AnimatePresence } from 'framer-motion'
import { X, Bot, RotateCcw } from 'lucide-react'
import { useChatStore } from '../store'
import { useIsDesktop } from '@/shared/hooks/useMediaQuery'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useAgentAction, usePhotoRecognize } from '../hooks/useAgentAction'

export function ChatDrawer() {
  const isDesktop = useIsDesktop()
  const { isOpen, close, messages, addMessage, reset, thread_id } = useChatStore()
  const agentMutation = useAgentAction()
  const photoMutation = usePhotoRecognize()

  if (!isDesktop) return null

  const handleSend = (text: string) => {
    addMessage({ role: 'user', content: text })
    agentMutation.mutate({ text })
  }

  const handleConfirm = (confirm: boolean) => {
    if (!thread_id) return
    if (confirm) {
      addMessage({ role: 'user', content: 'Yes, confirm' })
    } else {
      addMessage({ role: 'user', content: 'Cancel' })
    }
    agentMutation.mutate({ text: confirm ? 'yes' : 'cancel', confirm, thread_id })
  }

  const handleQuickAction = (text: string) => {
    handleSend(text)
  }

  const handlePhoto = (base64: string) => {
    photoMutation.mutate({ image_base64: base64 })
  }

  const isBusy = agentMutation.isPending || photoMutation.isPending

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="chat-drawer"
          initial={{ x: 420, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 420, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="fixed right-0 top-0 bottom-0 w-[420px] bg-card border-l border-border flex flex-col z-30 shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border shrink-0">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              <Bot className="w-4 h-4 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">Agent Command</p>
              <p className="text-[10px] text-muted-foreground">
                {messages.length > 0 ? `${messages.length} messages` : 'Ready to help'}
              </p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={reset}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="New chat"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={close}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Message list */}
          <MessageList onConfirm={handleConfirm} onQuickAction={handleQuickAction} />

          {/* Input */}
          <ChatInput
            onSend={handleSend}
            onPhoto={handlePhoto}
            disabled={isBusy}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
