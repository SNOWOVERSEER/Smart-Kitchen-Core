import { useEffect } from 'react'
import { Bell, Search, ChefHat } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '../stores/authStore'
import { logout, getProfile } from '@/features/auth/api'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import i18n from '@/shared/lib/i18n'

interface TopBarProps {
  searchValue?: string
  onSearchChange?: (value: string) => void
  title?: string
}

export function TopBar({ searchValue, onSearchChange, title }: TopBarProps) {
  const { t } = useTranslation()
  const { email, clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: getProfile })

  // Sync UI language whenever the user's preferred_language changes
  useEffect(() => {
    const lang = profile?.preferred_language
    if (lang && lang !== i18n.language) {
      void i18n.changeLanguage(lang)
    }
  }, [profile?.preferred_language])

  const displayName = profile?.display_name ?? ''
  const initials = displayName.trim()
    ? displayName.trim().split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : (email ? email.slice(0, 2).toUpperCase() : 'SK')

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      clearAuth()
      void navigate({ to: '/login' })
    }
  }

  return (
    <header className="flex items-center gap-3 h-14 px-4 lg:px-6 bg-card border-b border-border shrink-0">
      {/* Brand mark — mobile/tablet only (sidebar handles branding on desktop) */}
      <div className="flex lg:hidden items-center gap-2 shrink-0">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: '#C97B5C' }}
        >
          <ChefHat className="w-4 h-4 text-white" />
        </div>
        <span
          className="text-base text-foreground"
          style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
        >
          {t('nav.smartKitchen')}
        </span>
      </div>

      {/* Page title — desktop only */}
      {title && (
        <h1
          className="hidden lg:block text-lg text-foreground mr-2 shrink-0"
          style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
        >
          {title}
        </h1>
      )}

      {onSearchChange !== undefined && (
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('topbar.search')}
            className="pl-9 h-8 text-sm bg-muted border-0 rounded-full"
          />
        </div>
      )}

      <div className="flex-1" />

      <button className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer">
        <Bell className="w-4 h-4" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white cursor-pointer outline-none"
            style={{ backgroundColor: '#C97B5C' }}
          >
            {initials}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => void navigate({ to: '/settings' })}
          >
            {t('topbar.settings')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => void handleLogout()}
            className="text-destructive focus:text-destructive cursor-pointer"
          >
            {t('topbar.signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
