import { create } from 'zustand'
import type { AgentStatus, PendingActionResponse } from '@/shared/lib/api.types'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  status?: AgentStatus
  pendingAction?: PendingActionResponse
  isTyping?: boolean
}

interface ChatState {
  messages: Message[]
  thread_id: string | null
  isOpen: boolean
  agentStatus: AgentStatus | null
  open: () => void
  close: () => void
  setThreadId: (id: string) => void
  addMessage: (msg: Omit<Message, 'id' | 'timestamp'>) => string
  updateMessage: (id: string, updates: Partial<Message>) => void
  removeMessage: (id: string) => void
  reset: () => void
}

let _idCounter = 0
function genId() {
  return `msg_${Date.now()}_${++_idCounter}`
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  thread_id: null,
  isOpen: false,
  agentStatus: null,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  setThreadId: (id) => set({ thread_id: id }),

  addMessage: (msg) => {
    const id = genId()
    set((state) => ({
      messages: [...state.messages, { ...msg, id, timestamp: new Date() }],
    }))
    return id
  },

  updateMessage: (id, updates) => {
    set((state) => ({
      messages: state.messages.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }))
  },

  removeMessage: (id) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    }))
  },

  reset: () => set({ messages: [], thread_id: null, agentStatus: null }),
}))
