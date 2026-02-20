import { motion } from 'framer-motion'
import { ChefHat } from 'lucide-react'
import { type Message } from '../store'
import { ConfirmCard } from './ConfirmCard'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  message: Message
  onConfirm: (confirm: boolean) => void
}

export function MessageBubble({ message, onConfirm }: MessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex gap-2 items-end', isUser && 'flex-row-reverse')}
    >
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mb-0.5"
          style={{ backgroundColor: '#C97B5C' }}
        >
          <ChefHat className="w-3.5 h-3.5 text-white" />
        </div>
      )}

      <div className={cn('flex flex-col gap-1 max-w-[80%]', isUser && 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-3 py-2 text-sm leading-relaxed',
            isUser
              ? 'bg-foreground text-background rounded-br-sm'
              : 'bg-accent text-foreground rounded-bl-sm'
          )}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>

        {message.status === 'awaiting_confirm' && message.pendingAction && (
          <ConfirmCard
            pendingAction={message.pendingAction}
            onConfirm={onConfirm}
            confirmed={message.confirmed}
          />
        )}

        {message.status === 'awaiting_info' && message.pendingAction?.items && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {message.pendingAction.items.flatMap((item) =>
              item.missing_fields.map((field) => (
                <span
                  key={`${item.intent}-${field}`}
                  className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full border border-border cursor-pointer hover:bg-muted transition-colors"
                >
                  {field}
                </span>
              ))
            )}
          </div>
        )}

        <span className="text-[10px] text-muted-foreground px-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  )
}
