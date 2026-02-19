import { create } from 'zustand'

interface AuthState {
  access_token: string | null
  refresh_token: string | null
  user_id: string | null
  email: string | null
  isAuthenticated: boolean
  setAuth: (auth: {
    access_token: string
    refresh_token: string
    user_id: string
    email: string
  }) => void
  setAccessToken: (token: string) => void
  clearAuth: () => void
}

const REFRESH_TOKEN_KEY = 'sk_refresh_token'

export const useAuthStore = create<AuthState>((set) => ({
  access_token: null,
  refresh_token: localStorage.getItem(REFRESH_TOKEN_KEY),
  user_id: null,
  email: null,
  isAuthenticated: false,

  setAuth: ({ access_token, refresh_token, user_id, email }) => {
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token)
    set({ access_token, refresh_token, user_id, email, isAuthenticated: true })
  },

  setAccessToken: (token) => {
    set({ access_token: token, isAuthenticated: true })
  },

  clearAuth: () => {
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    set({
      access_token: null,
      refresh_token: null,
      user_id: null,
      email: null,
      isAuthenticated: false,
    })
  },
}))
