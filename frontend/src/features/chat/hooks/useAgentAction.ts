import { useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import i18n from '@/shared/lib/i18n'
import { useChatStore, type ThinkingStep } from '../store'
import { streamAgentAction, postPhotoRecognize } from '../api'
import { queryClient } from '@/shared/lib/queryClient'
import type { AgentActionRequest, PhotoRecognizeRequest } from '@/shared/lib/api.types'

function typewriterReveal(
  id: string,
  fullText: string,
  updateMessage: (id: string, updates: { content: string; isTyping?: boolean }) => void
) {
  let i = 0
  const interval = setInterval(() => {
    i += 3
    const revealed = fullText.slice(0, i)
    updateMessage(id, { content: revealed })
    if (i >= fullText.length) {
      clearInterval(interval)
      updateMessage(id, { content: fullText, isTyping: false })
    }
  }, 16)
}

/** Map graph node names to human-readable labels */
const NODE_LABELS: Record<string, string> = {
  handle_input: 'Processing input',
  agent: 'Thinking',
  execute_read: 'Searching inventory',
  build_preview: 'Preparing preview',
  execute_write: 'Executing changes',
  respond: 'Composing response',
}

const NODE_LABELS_ZH: Record<string, string> = {
  handle_input: '处理输入',
  agent: '思考中',
  execute_read: '查询库存',
  build_preview: '准备预览',
  execute_write: '执行变更',
  respond: '生成回复',
}

function getNodeLabel(node: string): string {
  const labels = i18n.language?.startsWith('zh') ? NODE_LABELS_ZH : NODE_LABELS
  return labels[node] ?? node
}

function createSmoothStreamRenderer(
  id: string,
  updateMessage: (id: string, updates: Partial<{ content: string; thinkingContent: string }>) => void,
) {
  let targetAnswer = ''
  let targetThinking = ''
  let renderedAnswer = ''
  let renderedThinking = ''
  let rafId = 0
  let lastFrameTs = 0

  const charsForFrame = (remaining: number, deltaMs: number) => {
    const charsPerSecond = Math.min(900, 120 + remaining * 4)
    return Math.max(1, Math.min(remaining, Math.floor((charsPerSecond * deltaMs) / 1000)))
  }

  const tick = (ts: number) => {
    const deltaMs = lastFrameTs ? Math.min(48, ts - lastFrameTs) : 16
    lastFrameTs = ts

    const updates: Partial<{ content: string; thinkingContent: string }> = {}

    const answerRemaining = targetAnswer.length - renderedAnswer.length
    if (answerRemaining > 0) {
      const chars = charsForFrame(answerRemaining, deltaMs)
      renderedAnswer = targetAnswer.slice(0, renderedAnswer.length + chars)
      updates.content = renderedAnswer
    }

    const thinkingRemaining = targetThinking.length - renderedThinking.length
    if (thinkingRemaining > 0) {
      const chars = charsForFrame(thinkingRemaining, deltaMs)
      renderedThinking = targetThinking.slice(0, renderedThinking.length + chars)
      updates.thinkingContent = renderedThinking
    }

    if (Object.keys(updates).length > 0) {
      updateMessage(id, updates)
    }

    if (renderedAnswer.length < targetAnswer.length || renderedThinking.length < targetThinking.length) {
      rafId = requestAnimationFrame(tick)
    } else {
      rafId = 0
      lastFrameTs = 0
    }
  }

  const ensureTick = () => {
    if (!rafId) {
      rafId = requestAnimationFrame(tick)
    }
  }

  return {
    pushAnswer: (chunk: string) => {
      if (!chunk) return
      targetAnswer += chunk
      ensureTick()
    },
    pushThinking: (chunk: string) => {
      if (!chunk) return
      targetThinking += chunk
      ensureTick()
    },
    flush: () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
      lastFrameTs = 0

      const updates: Partial<{ content: string; thinkingContent: string }> = {}
      if (renderedAnswer !== targetAnswer) {
        renderedAnswer = targetAnswer
        updates.content = renderedAnswer
      }
      if (renderedThinking !== targetThinking) {
        renderedThinking = targetThinking
        updates.thinkingContent = renderedThinking
      }
      if (Object.keys(updates).length > 0) {
        updateMessage(id, updates)
      }
    },
  }
}

export function useAgentAction() {
  const { addMessage, updateMessage, setThreadId, thread_id } = useChatStore()
  const typingIdRef = useRef<string>('')
  const startTimeRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const mutation = useMutation({
    mutationFn: async (req: AgentActionRequest) => {
      const msgId = typingIdRef.current
      const steps: ThinkingStep[] = []
      const renderer = createSmoothStreamRenderer(msgId, updateMessage)

      const controller = new AbortController()
      abortRef.current = controller

      try {
        return await streamAgentAction(
          { ...req, thread_id: req.thread_id ?? thread_id },
          {
            onToken: (token) => {
              renderer.pushAnswer(token)
            },
            onThinkingToken: (token) => {
              renderer.pushThinking(token)
            },
            onNode: (node) => {
              steps.push({ node, label: getNodeLabel(node), timestamp: Date.now() })
              updateMessage(msgId, { thinkingSteps: [...steps] })
            },
            onThreadId: (tid) => {
              setThreadId(tid)
            },
          },
          controller.signal,
        )
      } finally {
        renderer.flush()
        abortRef.current = null
      }
    },
    onMutate: () => {
      const typingId = addMessage({ role: 'assistant', content: '', isTyping: true })
      typingIdRef.current = typingId
      startTimeRef.current = performance.now()
    },
    onSuccess: (data) => {
      const msgId = typingIdRef.current
      const elapsedMs = Math.round(performance.now() - startTimeRef.current)

      updateMessage(msgId, {
        content: data.response,
        isTyping: false,
        status: data.status,
        pendingAction: data.pending_action ?? undefined,
        pendingRecipes: data.pending_recipes ?? undefined,
        elapsedMs,
      })

      if (data.status === 'completed') {
        void queryClient.invalidateQueries({ queryKey: ['inventory'] })
        void queryClient.invalidateQueries({ queryKey: ['logs'] })
        void queryClient.invalidateQueries({ queryKey: ['shopping'] })
        void queryClient.invalidateQueries({ queryKey: ['recipes'] })
        void queryClient.invalidateQueries({ queryKey: ['meals'] })
      }
    },
    onError: () => {
      const msgId = typingIdRef.current
      if (msgId) {
        updateMessage(msgId, {
          content: 'Something went wrong. Please try again.',
          isTyping: false,
        })
      }
    },
  })

  return { ...mutation, abort }
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
      return { typingId, startTime: performance.now() }
    },
    onSuccess: (data, _vars, context) => {
      const { typingId, startTime } = context as { typingId: string; startTime: number }
      const elapsedMs = Math.round(performance.now() - startTime)
      setThreadId(data.agent_response.thread_id)
      removeMessage(typingId)

      const assistantId = addMessage({
        role: 'assistant',
        content: '',
        isTyping: true,
        status: data.agent_response.status,
        pendingAction: data.agent_response.pending_action ?? undefined,
        elapsedMs,
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
