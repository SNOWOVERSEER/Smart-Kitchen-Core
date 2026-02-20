import { useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { motion } from 'framer-motion'
import { ChefHat, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { useAuthStore } from '@/shared/stores/authStore'
import { signup } from '../api'
import toast from 'react-hot-toast'

export function SignupPage() {
  const { t } = useTranslation()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || !displayName) return
    if (password.length < 8) {
      toast.error(t('auth.passwordTooShort'))
      return
    }
    setLoading(true)
    try {
      const data = await signup(email, password, displayName)
      if (data.requires_email_verification || !data.access_token || !data.refresh_token || !data.user_id) {
        toast.success(t('auth.signupCheckEmail'))
        void navigate({ to: '/login' })
        return
      }
      setAuth({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user_id: data.user_id,
        email: data.email,
      })
      void navigate({ to: '/' })
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        toast.error(t('auth.emailAlreadyRegistered'))
      } else {
        toast.error(t('auth.signupFailed'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'radial-gradient(ellipse at 60% 20%, #F5EAE4 0%, #FAFAF7 60%)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: '#C97B5C' }}
          >
            <ChefHat className="w-6 h-6 text-white" />
          </div>
          <h1
            className="text-2xl text-foreground"
            style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
          >
            {t('auth.brandName')}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t('auth.createAccountSubtitle')}</p>
        </div>

        <Card className="border-border shadow-md">
          <CardHeader className="pb-4" />
          <CardContent>
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name" className="text-sm">{t('auth.displayName')}</Label>
                <Input
                  id="name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('auth.displayNamePlaceholder')}
                  required
                  autoComplete="name"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="text-sm">{t('auth.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('auth.emailPlaceholder')}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="password" className="text-sm">{t('auth.password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t('auth.passwordMinLength')}
                    required
                    autoComplete="new-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full mt-1">
                {loading ? t('auth.creatingAccount') : t('auth.createAccount')}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-4">
              {t('auth.alreadyHaveAccount')}{' '}
              <Link to={'/login' as string} className="text-foreground hover:underline font-medium">
                {t('auth.signIn')}
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
