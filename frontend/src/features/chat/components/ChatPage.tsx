import { ArrowLeft, Bot, RotateCcw } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { useChatStore } from '../store'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { useAgentAction, usePhotoRecognize } from '../hooks/useAgentAction'
import { useIsDesktop } from '@/shared/hooks/useMediaQuery'
import { useEffect } from 'react'

export function ChatPage() {
  const isDesktop = useIsDesktop()
  const navigate = useNavigate()
  const { messages, addMessage, reset, thread_id, open } = useChatStore()
  const agentMutation = useAgentAction()
  const photoMutation = usePhotoRecognize()

  // On desktop, redirect to home and open chat drawer
  useEffect(() => {
    if (isDesktop) {
      open()
      void navigate({ to: '/' })
    }
  }, [isDesktop, open, navigate])

  const handleSend = (text: string) => {
    addMessage({ role: 'user', content: text })
    agentMutation.mutate({ text })
  }

  const handleConfirm = (confirm: boolean) => {
    if (!thread_id) return
    addMessage({ role: 'user', content: confirm ? 'Yes, confirm' : 'Cancel' })
    agentMutation.mutate({ text: confirm ? 'yes' : 'cancel', confirm, thread_id })
  }

  const handlePhoto = (base64: string) => {
    photoMutation.mutate({ image_base64: base64 })
  }

  const isBusy = agentMutation.isPending || photoMutation.isPending

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 h-14 border-b border-border bg-card shrink-0">
        <button
          onClick={() => void navigate({ to: '/' })}
          className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
          <Bot className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">Agent Command</p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={reset}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <MessageList onConfirm={handleConfirm} onQuickAction={handleSend} />

      {/* Input */}
      <ChatInput onSend={handleSend} onPhoto={handlePhoto} disabled={isBusy} />
    </div>
  )
}
