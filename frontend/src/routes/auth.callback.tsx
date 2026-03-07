// frontend/src/routes/auth.callback.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { supabase } from '../shared/lib/supabase'
import { useAuthStore } from '../shared/stores/authStore'
import { getProfile, updateProfile } from '../features/auth/api'
import { queryClient } from '../shared/lib/queryClient'

function OAuthCallback() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()

  useEffect(() => {
    const handleCallback = async () => {
      const { data, error } = await supabase.auth.getSession()
      if (error || !data.session) {
        void navigate({ to: '/' })
        return
      }

      const session = data.session
      setAuth({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user_id: session.user.id,
        email: session.user.email ?? '',
      })

      const metadata = session.user.user_metadata as Record<string, unknown> | undefined
      const displayNameCandidate =
        (typeof metadata?.full_name === 'string' && metadata.full_name.trim()) ||
        (typeof metadata?.name === 'string' && metadata.name.trim()) ||
        ''

      try {
        let profile = await getProfile()
        if (!profile.display_name?.trim() && displayNameCandidate) {
          profile = await updateProfile({ display_name: displayNameCandidate })
        }
        queryClient.setQueryData(['profile'], profile)
      } catch {
        if (displayNameCandidate) {
          try {
            const profile = await updateProfile({ display_name: displayNameCandidate })
            queryClient.setQueryData(['profile'], profile)
          } catch {
            // Ignore profile sync failures so OAuth login still succeeds.
          }
        }
      }

      void navigate({ to: '/dashboard' })
    }

    void handleCallback()
  }, [navigate, setAuth])

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCF8]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[#C97B5C] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#8C7B6E]">Signing you in...</p>
      </div>
    </div>
  )
}

export const Route = createFileRoute('/auth/callback')({
  component: OAuthCallback,
})
