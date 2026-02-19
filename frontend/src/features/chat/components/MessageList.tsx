import { useEffect, useRef } from 'react'
import { Bot, Zap, PlusCircle } from 'lucide-react'
import { useChatStore } from '../store'
import { MessageBubble } from './MessageBubble'
import { TypingIndicator } from './TypingIndicator'

interface MessageListProps {
  onConfirm: (confirm: boolean) => void
  onQuickAction?: (text: string) => void
}

const QUICK_ACTIONS = [
  { label: 'What expires soon?', text: 'What items in my fridge expire soon?' },
  { label: 'Add items', text: 'I want to add some items to my inventory' },
  { label: 'Scan receipt', text: 'Help me log items from my grocery receipt' },
]

export function MessageList({ onConfirm, onQuickAction }: MessageListProps) {
  const { messages } = useChatStore()
  const bottomRef = useRef<HTMLDivElement>(null)
  const isTyping = messages.some((m) => m.isTyping)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-4 py-8">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
          <Bot className="w-6 h-6 text-muted-foreground" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-foreground">Agent Command</p>
          <p className="text-xs text-muted-foreground mt-1">
            Tell me what you bought, consumed, or want to track
          </p>
        </div>
        {onQuickAction && (
          <div className="flex flex-col gap-2 w-full max-w-xs">
            {QUICK_ACTIONS.map(({ label, text }) => (
              <button
                key={label}
                onClick={() => onQuickAction(text)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-sm text-foreground hover:bg-muted transition-colors text-left"
              >
                {label === 'Add items' ? (
                  <PlusCircle className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <Zap className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} onConfirm={onConfirm} />
      ))}
      {isTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  )
}
