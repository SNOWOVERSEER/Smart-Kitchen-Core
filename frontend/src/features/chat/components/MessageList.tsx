import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ChefHat } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useChatStore } from '../store'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'

interface MessageListProps {
  onConfirm: (confirm: boolean) => void
  onQuickAction?: (text: string) => void
}

export function MessageList({ onConfirm, onQuickAction }: MessageListProps) {
  const { t } = useTranslation()
  const { messages } = useChatStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const isTyping = messages.some((m) => m.isTyping)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const suggestions = [
    t('chat.suggestion1'),
    t('chat.suggestion2'),
    t('chat.suggestion3'),
    t('chat.suggestion4'),
  ]

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
      {messages.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center justify-center h-full gap-5 px-6 text-center"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm"
            style={{ background: 'linear-gradient(135deg, #F5EAE4 0%, #EDDDD4 100%)' }}
          >
            <ChefHat className="w-8 h-8" style={{ color: '#C97B5C' }} />
          </div>
          <div>
            <p
              className="text-lg font-semibold text-[#1C1612]"
              style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
            >
              {t('chat.agentTitle')}
            </p>
            <p className="text-sm text-stone-500 mt-1 leading-relaxed">
              {t('chat.agentSubtitle')}
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            {suggestions.map((suggestion, i) => (
              <motion.button
                key={suggestion}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onQuickAction?.(suggestion)}
                className="text-sm text-left px-4 py-3 rounded-xl border border-stone-200/60 bg-white shadow-[0_1px_4px_-1px_rgba(28,22,18,0.06)] hover:bg-stone-50 hover:border-stone-300/60 transition-colors cursor-pointer text-stone-600"
              >
                {suggestion}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} onConfirm={onConfirm} />
      ))}
      {isTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  )
}
