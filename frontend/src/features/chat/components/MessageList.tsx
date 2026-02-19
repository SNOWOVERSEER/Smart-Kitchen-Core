import { useEffect, useRef } from 'react'
import { ChefHat } from 'lucide-react'
import { useChatStore } from '../store'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'

interface MessageListProps {
  onConfirm: (confirm: boolean) => void
  onQuickAction?: (text: string) => void
}

export function MessageList({ onConfirm, onQuickAction }: MessageListProps) {
  const { messages } = useChatStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const isTyping = messages.some((m) => m.isTyping)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full gap-6 px-6 text-center">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: '#F5EAE4' }}
          >
            <ChefHat className="w-7 h-7" style={{ color: '#C97B5C' }} />
          </div>
          <div>
            <p
              className="text-base font-semibold text-foreground"
              style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
            >
              Kitchen Agent
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Tell me what you used, bought, or want to know.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xs">
            {[
              'I drank 500ml of milk',
              'Add 6 eggs to the fridge',
              'What expires soon?',
            ].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => onQuickAction?.(suggestion)}
                className="text-sm text-left px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-muted transition-colors cursor-pointer"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} onConfirm={onConfirm} />
      ))}
      {isTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  )
}
