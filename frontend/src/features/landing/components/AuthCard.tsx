// frontend/src/features/landing/components/AuthCard.tsx
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Eye, EyeOff, Lock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../../shared/lib/supabase'
import { useAuthStore } from '../../../shared/stores/authStore'
import { login, signup } from '../../auth/api'
import toast from 'react-hot-toast'

// Google 'G' SVG icon (inline, no external URL dependency)
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  )
}

type Tab = 'signin' | 'signup'

export function AuthCard() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [tab, setTab] = useState<Tab>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const handleGoogleOAuth = async () => {
    setGoogleLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      toast.error('Google sign-in failed. Please try again.')
      setGoogleLoading(false)
    }
    // If success, browser will redirect — no need to reset loading
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    try {
      if (tab === 'signin') {
        // login returns AuthResponse: all fields non-nullable, maps directly to setAuth
        const data = await login(email, password)
        setAuth(data)
        void navigate({ to: '/dashboard' })
      } else {
        if (!displayName.trim()) { toast.error('Display name is required'); return }
        if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
        // signup returns SignupResponse: access_token/refresh_token/user_id are string | null
        // Non-null assertions are safe here because when access_token is present these are populated
        const data = await signup(email, password, displayName.trim())
        if (data.requires_email_verification) {
          toast.success('Check your email to confirm your account before signing in.')
          setTab('signin')
          return
        }
        if (data.access_token) {
          setAuth({
            access_token: data.access_token,
            refresh_token: data.refresh_token!,
            user_id: data.user_id!,
            email: data.email,
          })
          void navigate({ to: '/dashboard' })
        }
      }
    } catch {
      toast.error(tab === 'signin' ? 'Invalid email or password' : 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      id="hero-auth"
      className="p-7 rounded-3xl shadow-sm max-w-md w-full"
      style={{ backgroundColor: 'var(--lp-surface)', border: '1px solid var(--lp-surface-dark)' }}
    >
      {/* Google button */}
      <button
        onClick={() => void handleGoogleOAuth()}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-3 bg-white py-3.5 rounded-xl font-medium border transition-colors disabled:opacity-60"
        style={{ borderColor: 'var(--lp-surface-dark)' }}
        onMouseEnter={(e) => !googleLoading && (e.currentTarget.style.backgroundColor = '#F9FAFB')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
      >
        <GoogleIcon />
        <span style={{ color: 'var(--lp-ink)' }}>Continue with Google</span>
      </button>

      {/* Divider */}
      <div className="flex items-center gap-4 my-5">
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--lp-surface-dark)' }} />
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--lp-ink-muted)' }}>or</span>
        <div className="flex-1 h-px" style={{ backgroundColor: 'var(--lp-surface-dark)' }} />
      </div>

      {/* Tab toggle */}
      <div
        className="flex rounded-xl p-1 mb-5 gap-1"
        style={{ backgroundColor: 'var(--lp-surface-dark)' }}
      >
        {(['signin', 'signup'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
            style={{
              backgroundColor: tab === t ? 'white' : 'transparent',
              color: tab === t ? 'var(--lp-ink)' : 'var(--lp-ink-muted)',
              boxShadow: tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {t === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        ))}
      </div>

      {/* Form */}
      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-3">
        <AnimatePresence>
          {tab === 'signup' && (
            <motion.input
              key="displayName"
              initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: 'auto', marginBottom: 0 }}
              exit={{ opacity: 0, height: 0 }}
              type="text"
              placeholder="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-3.5 rounded-xl border bg-white focus:outline-none transition-all text-sm"
              style={{ borderColor: 'var(--lp-surface-dark)', color: 'var(--lp-ink)' }}
            />
          )}
        </AnimatePresence>
        <input
          type="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-3.5 rounded-xl border bg-white focus:outline-none transition-all text-sm"
          style={{ borderColor: 'var(--lp-surface-dark)', color: 'var(--lp-ink)' }}
        />
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full px-4 py-3.5 pr-11 rounded-xl border bg-white focus:outline-none transition-all text-sm"
            style={{ borderColor: 'var(--lp-surface-dark)', color: 'var(--lp-ink)' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
            style={{ color: 'var(--lp-ink-muted)' }}
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 rounded-xl text-white font-medium text-sm transition-colors disabled:opacity-60 mt-1"
          style={{ backgroundColor: 'var(--lp-brand)' }}
          onMouseEnter={(e) => !loading && (e.currentTarget.style.backgroundColor = 'var(--lp-brand-hover)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'var(--lp-brand)')}
        >
          {loading ? (tab === 'signin' ? 'Signing in...' : 'Creating account...') : (tab === 'signin' ? 'Sign in' : 'Create account')}
        </button>
      </form>

      {/* Trust row */}
      <div className="flex flex-wrap items-center justify-center gap-5 mt-5">
        {[
          { color: 'bg-[#C8745D]', text: 'BYO API key' },
          { color: 'bg-emerald-500', text: 'Free to start' },
          { color: 'bg-blue-500', text: '$5/mo member' },
        ].map(({ color, text }) => (
          <div key={text} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-xs font-medium" style={{ color: 'var(--lp-ink-muted)' }}>{text}</span>
          </div>
        ))}
      </div>

      {/* Secure note */}
      <p className="flex items-center justify-center gap-1.5 mt-4 text-[11px]" style={{ color: 'var(--lp-ink-muted)' }}>
        <Lock size={11} />
        Your data is encrypted and scoped to your account
      </p>
    </div>
  )
}
