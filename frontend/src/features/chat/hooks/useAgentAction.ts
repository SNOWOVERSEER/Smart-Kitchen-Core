import { useMutation } from '@tanstack/react-query'
import { useChatStore } from '../store'
import { postAgentAction, postPhotoRecognize } from '../api'
import { queryClient } from '@/shared/lib/queryClient'
import type { AgentActionRequest, PhotoRecognizeRequest } from '@/shared/lib/api.types'

function typewriterReveal(
  id: string,
  fullText: string,
  updateMessage: (id: string, updates: { content: string; isTyping?: boolean }) => void
) {
  let i = 0
  const interval = setInterval(() => {
    i += 3 // reveal 3 chars per tick for speed
    const revealed = fullText.slice(0, i)
    updateMessage(id, { content: revealed })
    if (i >= fullText.length) {
      clearInterval(interval)
      updateMessage(id, { content: fullText, isTyping: false })
    }
  }, 16)
}

export function useAgentAction() {
  const { addMessage, updateMessage, removeMessage, setThreadId, thread_id } = useChatStore()

  return useMutation({
    mutationFn: async (req: AgentActionRequest) => {
      return postAgentAction({ ...req, thread_id: req.thread_id ?? thread_id })
    },
    onMutate: () => {
      const typingId = addMessage({ role: 'assistant', content: '', isTyping: true })
      return { typingId }
    },
    onSuccess: (data, _vars, context) => {
      const { typingId } = context as { typingId: string }
      setThreadId(data.thread_id)
      removeMessage(typingId)

      const assistantId = addMessage({
        role: 'assistant',
        content: '',
        isTyping: true,
        status: data.status,
        pendingAction: data.pending_action ?? undefined,
      })

      typewriterReveal(assistantId, data.response, updateMessage)

      if (data.status === 'completed') {
        void queryClient.invalidateQueries({ queryKey: ['inventory'] })
        void queryClient.invalidateQueries({ queryKey: ['logs'] })
      }
    },
    onError: (_error, _vars, context) => {
      const { typingId } = context as { typingId: string }
      removeMessage(typingId)
      addMessage({
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
      })
    },
  })
}

export function usePhotoRecognize() {
  const { addMessage, updateMessage, removeMessage, setThreadId, thread_id } = useChatStore()

  return useMutation({
    mutationFn: async (req: PhotoRecognizeRequest) => {
      return postPhotoRecognize({ ...req, thread_id: req.thread_id ?? thread_id })
    },
    onMutate: () => {
      addMessage({ role: 'user', content: '[Photo sent]' })
      const typingId = addMessage({ role: 'assistant', content: '', isTyping: true })
      return { typingId }
    },
    onSuccess: (data, _vars, context) => {
      const { typingId } = context as { typingId: string }
      setThreadId(data.agent_response.thread_id)
      removeMessage(typingId)

      const assistantId = addMessage({
        role: 'assistant',
        content: '',
        isTyping: true,
        status: data.agent_response.status,
        pendingAction: data.agent_response.pending_action ?? undefined,
      })

      typewriterReveal(assistantId, data.agent_response.response, updateMessage)
    },
    onError: (_error, _vars, context) => {
      const { typingId } = context as { typingId: string }
      removeMessage(typingId)
      addMessage({ role: 'assistant', content: 'Could not process the photo. Please try again.' })
    },
  })
}
