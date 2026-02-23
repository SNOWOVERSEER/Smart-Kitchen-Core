// frontend/src/routes/index.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { LandingPage } from '../features/landing/components/LandingPage'
import { useAuthStore } from '../shared/stores/authStore'

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    const { isAuthenticated } = useAuthStore.getState()
    if (isAuthenticated) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: LandingPage,
})
