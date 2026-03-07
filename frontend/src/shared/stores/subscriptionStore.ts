import { create } from 'zustand'

export interface SubscriptionState {
  tier: 'free' | 'supporter' | 'byok'
  promptCredits: number
  bonusCredits: number
  totalCredits: number
  hasApiKey: boolean
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  loaded: boolean
  setSubscription: (data: Omit<SubscriptionState, 'loaded' | 'setSubscription' | 'decrementCredit' | 'clearSubscription'>) => void
  decrementCredit: () => void
  clearSubscription: () => void
}

export const useSubscriptionStore = create<SubscriptionState>((set) => ({
  tier: 'free',
  promptCredits: 0,
  bonusCredits: 0,
  totalCredits: 0,
  hasApiKey: false,
  trialEndsAt: null,
  currentPeriodEnd: null,
  loaded: false,

  setSubscription: (data) => set({ ...data, loaded: true }),

  decrementCredit: () =>
    set((state) => {
      if (state.tier === 'byok') return state
      return {
        totalCredits: Math.max(0, state.totalCredits - 1),
        promptCredits: state.promptCredits > 0
          ? state.promptCredits - 1
          : state.promptCredits,
        bonusCredits: state.promptCredits > 0
          ? state.bonusCredits
          : Math.max(0, state.bonusCredits - 1),
      }
    }),

  clearSubscription: () =>
    set({
      tier: 'free',
      promptCredits: 0,
      bonusCredits: 0,
      totalCredits: 0,
      hasApiKey: false,
      trialEndsAt: null,
      currentPeriodEnd: null,
      loaded: false,
    }),
}))
