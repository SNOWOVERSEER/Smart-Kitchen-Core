import { motion, AnimatePresence } from 'framer-motion'
import { X, ChefHat, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useChatStore } from '../store'
import { useIsDesktop } from '@/shared/hooks/useMediaQuery'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useAgentAction, usePhotoRecognize } from '../hooks/useAgentAction'
import { useSupportsVision } from '../hooks/useActiveProvider'

export function ChatDrawer() {
  const { t } = useTranslation()
  const isDesktop = useIsDesktop()
  const { isOpen, close, messages, addMessage, updateMessage, reset, thread_id } = useChatStore()
  const agentMutation = useAgentAction()
  const photoMutation = usePhotoRecognize()
  const supportsVision = useSupportsVision()

  if (!isDesktop) return null

  const handleSend = (text: string) => {
    addMessage({ role: 'user', content: text })
    agentMutation.mutate({ text })
  }

  const handleConfirm = (confirm: boolean) => {
    if (!thread_id) return
    const awaitingMsg = [...messages].reverse().find(
      (m) => m.status === 'awaiting_confirm' && !m.confirmed
    )
    if (awaitingMsg) {
      updateMessage(awaitingMsg.id, { confirmed: confirm ? 'yes' : 'no' })
    }
    addMessage({ role: 'user', content: confirm ? t('chat.confirmButton') : t('chat.cancelButton') })
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
        <>
          {/* Backdrop */}
          <motion.div
            key="chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={close}
            className="fixed inset-0 bg-stone-900/20 backdrop-blur-[2px] z-29"
          />
          {/* Drawer */}
          <motion.div
            key="chat-drawer"
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] bg-[#FAF6F1] border-l border-stone-200/60 flex flex-col z-30 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-2.5 px-4 h-14 border-b border-stone-200/60 bg-white shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#C97B5C' }}
              >
                <ChefHat className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[#1C1612]">{t('chat.drawerTitle')}</p>
                <p className="text-[10px] text-stone-400">
                  {messages.length > 0
                    ? t('chat.drawerMessages', { count: messages.length })
                    : t('chat.drawerReady')}
                </p>
              </div>
              {messages.length > 0 && (
                <button
                  onClick={reset}
                  className="w-8 h-8 flex items-center justify-center rounded-xl text-stone-400 hover:text-[#1C1612] hover:bg-stone-100 transition-colors"
                  title={t('chat.newChat')}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={close}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-stone-400 hover:text-[#1C1612] hover:bg-stone-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message list */}
            <MessageList onConfirm={handleConfirm} onQuickAction={handleQuickAction} />

            {/* Input */}
            <ChatInput
              onSend={handleSend}
              onPhoto={supportsVision ? handlePhoto : undefined}
              disabled={isBusy}
              noVisionReason={!supportsVision}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
