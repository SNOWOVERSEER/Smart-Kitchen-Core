import { motion } from 'framer-motion'
import { ChefHat } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { type Message } from '../store'
import { ChatRecipeCards } from './ChatRecipeCards'
import { ConfirmCard } from './ConfirmCard'
import { cn } from '@/lib/utils'

interface MessageBubbleProps {
  message: Message
  onConfirm: (confirm: boolean) => void
}

export function MessageBubble({ message, onConfirm }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const hasRecipes = message.pendingRecipes && message.pendingRecipes.length > 0
  const hasConfirm = message.status === 'awaiting_confirm' && message.pendingAction

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn('flex gap-2.5', isUser ? 'flex-row-reverse' : 'items-start')}
    >
      {/* Agent avatar */}
      {!isUser && (
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
          style={{ backgroundColor: '#C97B5C' }}
        >
          <ChefHat className="w-3.5 h-3.5 text-white" />
        </div>
      )}

      <div className={cn('flex flex-col gap-1.5 max-w-[82%] min-w-0', isUser && 'items-end')}>
        {/* Text bubble */}
        {message.content && (
          <div
            className={cn(
              'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
              isUser
                ? 'bg-[#1C1612] text-white rounded-br-md'
                : 'bg-white border border-stone-200/60 shadow-[0_1px_6px_-2px_rgba(28,22,18,0.07)] text-[#1C1612] rounded-bl-md'
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : (
              <div className="prose-chat">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => (
                      <p className="whitespace-pre-wrap break-words mb-1.5 last:mb-0">{children}</p>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-[#1C1612]">{children}</strong>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-outside pl-4 space-y-0.5 my-1.5">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-outside pl-4 space-y-0.5 my-1.5">{children}</ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-sm leading-relaxed">{children}</li>
                    ),
                    code: ({ children, className }) => {
                      const isInline = !className
                      return isInline ? (
                        <code className="text-xs bg-stone-100 text-[#C97B5C] px-1 py-0.5 rounded font-mono">{children}</code>
                      ) : (
                        <code className="block text-xs bg-stone-50 text-stone-700 p-2 rounded-lg font-mono my-1.5 overflow-x-auto">{children}</code>
                      )
                    },
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-2">
                        <table className="text-xs border-collapse w-full">{children}</table>
                      </div>
                    ),
                    th: ({ children }) => (
                      <th className="text-left font-semibold text-stone-600 px-2 py-1.5 border-b border-stone-200 bg-stone-50">{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className="text-stone-600 px-2 py-1 border-b border-stone-100">{children}</td>
                    ),
                    a: ({ children, href }) => (
                      <a href={href} className="text-[#C97B5C] underline underline-offset-2 hover:text-[#B56A4B]" target="_blank" rel="noopener noreferrer">{children}</a>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-[#C97B5C]/40 pl-3 my-1.5 text-stone-500 italic">{children}</blockquote>
                    ),
                    hr: () => (
                      <hr className="border-stone-200 my-2" />
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            )}
          </div>
        )}

        {/* Recipe cards — outside the bubble for better layout */}
        {hasRecipes && (
          <div className="w-full">
            <ChatRecipeCards recipes={message.pendingRecipes!} />
          </div>
        )}

        {/* Confirm card — outside the bubble */}
        {hasConfirm && (
          <ConfirmCard
            pendingAction={message.pendingAction!}
            onConfirm={onConfirm}
            confirmed={message.confirmed}
          />
        )}

        {/* Missing fields hints */}
        {message.status === 'awaiting_info' && message.pendingAction?.items && (
          <div className="flex flex-wrap gap-1.5">
            {message.pendingAction.items.flatMap((item) =>
              item.missing_fields.map((field) => (
                <span
                  key={`${item.intent}-${field}`}
                  className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-200/60 font-medium"
                >
                  {field}
                </span>
              ))
            )}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-stone-400 px-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  )
}
