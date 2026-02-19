import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { useAuthStore } from '../shared/stores/authStore'
import { Layout } from '../shared/components/Layout'
import { refreshToken } from '../features/auth/api'

export const Route = createFileRoute('/_protected')({
  beforeLoad: async () => {
    const { isAuthenticated, refresh_token, clearAuth } = useAuthStore.getState()

    // Already have a valid access token in memory
    if (isAuthenticated) return

    // No refresh token at all — send to login
    if (!refresh_token) {
      throw redirect({ to: '/login' })
    }

    // Have a refresh token but no access token (e.g. page reload).
    // Eagerly exchange it so every subsequent API call has a token.
    // Supabase rotates the refresh_token on every refresh — we must save the new one.
    try {
      const data = await refreshToken(refresh_token)
      useAuthStore.getState().setAuth({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user_id: data.user_id,
        email: data.email,
      })
    } catch {
      clearAuth()
      throw redirect({ to: '/login' })
    }
  },
  component: () => (
    <Layout>
      <Outlet />
    </Layout>
  ),
})
