import { createFileRoute, redirect } from '@tanstack/react-router'
import { LandingPage } from '../features/landing/components/LandingPage'
import { useAuthStore } from '../shared/stores/authStore'

export const Route = createFileRoute('/login')({
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState()
    if (isAuthenticated) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: LandingPage,
})
