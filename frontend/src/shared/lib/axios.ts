import axios from 'axios'
import { useAuthStore } from '../stores/authStore'

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001'

export const apiClient = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach access token to every request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().access_token
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Track in-flight refresh to avoid parallel refresh calls
let refreshPromise: Promise<string> | null = null

async function refreshAccessToken(): Promise<string> {
  const { refresh_token, setAuth, clearAuth } = useAuthStore.getState()
  if (!refresh_token) {
    clearAuth()
    window.location.href = '/login'
    throw new Error('No refresh token')
  }

  // Backend expects refresh_token as a query param, and returns a full AuthResponse
  // including a rotated refresh_token — we must persist both tokens.
  const response = await axios.post(
    `${baseURL}/auth/refresh`,
    null,
    { params: { refresh_token } }
  )
  const data = response.data as {
    access_token: string
    refresh_token: string
    user_id: string
    email: string
  }
  setAuth({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user_id: data.user_id,
    email: data.email,
  })
  return data.access_token
}

// 401 interceptor — refresh and retry once
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null
          })
        }
        const newToken = await refreshPromise
        originalRequest.headers.Authorization = `Bearer ${newToken}`
        return apiClient(originalRequest)
      } catch {
        useAuthStore.getState().clearAuth()
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
