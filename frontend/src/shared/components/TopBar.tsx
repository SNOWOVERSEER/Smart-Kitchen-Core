import { type ReactNode, useEffect } from 'react'
import { Bell, Search, ChefHat, type LucideIcon } from 'lucide-react'
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
import { cn } from '@/lib/utils'

interface TopBarProps {
  searchValue?: string
  onSearchChange?: (value: string) => void
  title?: string
  mobileIcon?: LucideIcon
  mobileActionsReverse?: boolean
  hideActions?: boolean
  actionsOnly?: boolean
  extraActions?: ReactNode
  className?: string
}

export function TopBar({
  searchValue,
  onSearchChange,
  title,
  mobileIcon: MobileIconProp,
  mobileActionsReverse = false,
  hideActions = false,
  actionsOnly = false,
  extraActions,
  className,
}: TopBarProps) {
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
    : (email ? email.slice(0, 2).toUpperCase() : 'KL')

  const handleLogout = async () => {
    try {
      await logout()
    } finally {
      clearAuth()
      void navigate({ to: '/login' })
    }
  }

  const hasSearch = onSearchChange !== undefined

  // 44 px minimum touch target (iOS HIG / WCAG 2.5.5)
  const iconButtonClass = cn(
    'w-11 h-11 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer',
    actionsOnly && 'bg-transparent'
  )

  const avatarButtonClass = cn(
    'w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold text-white cursor-pointer outline-none',
    actionsOnly && 'border border-stone-200/70 shadow-sm'
  )

  function renderActions() {
    return (
      <>
        {extraActions && (
          <div className="flex items-center shrink-0">
            {extraActions}
          </div>
        )}

        {!hideActions && (
          <>
            <button className={iconButtonClass}>
              <Bell className="w-[18px] h-[18px]" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={avatarButtonClass}
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
          </>
        )}
      </>
    )
  }

  const MobileIcon = MobileIconProp ?? ChefHat
  const mobileLeadLabel = title ?? t('nav.brand')
  const brandLabel = t('nav.brand')
  const showBrandLine = mobileLeadLabel !== brandLabel
  const mobileLead = (
    <div className="flex items-center gap-2 shrink-0 min-w-0">
      <div
        className={cn(
          'rounded-lg flex items-center justify-center shrink-0',
          showBrandLine
            ? 'w-9 h-9 [@media(max-width:380px)]:w-8 [@media(max-width:380px)]:h-8'
            : 'w-7 h-7'
        )}
        style={{ backgroundColor: '#C97B5C' }}
      >
        <MobileIcon
          className={cn(
            'text-white',
            showBrandLine
              ? 'w-[18px] h-[18px] [@media(max-width:380px)]:w-4 [@media(max-width:380px)]:h-4'
              : 'w-4 h-4'
          )}
        />
      </div>
      <div className="min-w-0">
        {showBrandLine && (
          <p className="text-[9px] leading-none font-semibold tracking-[0.11em] uppercase text-stone-400 [@media(max-width:380px)]:text-[8px]">
            {brandLabel}
          </p>
        )}
        <p
          className={cn(
            'text-foreground truncate',
            showBrandLine ? 'text-[1.03rem] [@media(max-width:380px)]:text-[0.98rem] leading-tight mt-0.5' : 'text-base'
          )}
          style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
        >
          {mobileLeadLabel}
        </p>
      </div>
    </div>
  )

  function renderMobileActions() {
    return (
      <div className={cn('flex items-center gap-2 shrink-0', mobileActionsReverse && 'flex-row-reverse')}>
        {renderActions()}
      </div>
    )
  }

  if (actionsOnly) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        {renderActions()}
      </div>
    )
  }

  return (
    <header className={cn('bg-card border-b border-border shadow-[0_1px_0_rgba(28,22,18,0.04)] shrink-0 px-4 sm:px-5 lg:px-6', className)}>
      {hasSearch ? (
        <>
          <div className="lg:hidden pt-2.5 pb-3 sm:pt-3 sm:pb-4">
            <div className="flex items-center gap-2.5 min-h-[clamp(2.95rem,6.7vh,3.4rem)]">
              {mobileLead}
              <div className="flex-1" />
              {renderMobileActions()}
            </div>

            <div className="mt-2.5 sm:mt-3">
              <div className="relative w-full">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={searchValue}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  placeholder={t('topbar.search')}
                  className="pl-10 h-10 sm:h-11 text-sm sm:text-[15px] bg-muted border-0 rounded-full w-full"
                />
              </div>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-3 h-14">
            {/* Page title — desktop only */}
            {title && (
              <h1
                className="text-lg text-foreground mr-2 shrink-0"
                style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
              >
                {title}
              </h1>
            )}

            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={searchValue}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder={t('topbar.search')}
                className="pl-9 h-8 text-sm bg-muted border-0 rounded-full"
              />
            </div>

            <div className="flex-1" />
            {renderActions()}
          </div>
        </>
      ) : (
        <div className="h-[clamp(3.5rem,7.4vh,4.25rem)] flex items-center gap-3">
          {/* Mobile page lead */}
          <div className="lg:hidden">
            {mobileLead}
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

          <div className="flex-1" />

          <div className="lg:hidden">
            {renderMobileActions()}
          </div>

          <div className="hidden lg:flex items-center gap-2 shrink-0">
            {renderActions()}
          </div>
        </div>
      )}
    </header>
  )
}
