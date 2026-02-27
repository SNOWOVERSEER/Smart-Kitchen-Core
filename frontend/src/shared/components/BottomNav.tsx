import type { ElementType } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutDashboard, Bot, Settings, UtensilsCrossed, ShoppingCart } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const NAV_ITEMS: { to: string; icon: ElementType; key: string }[] = [
  { to: '/dashboard', icon: LayoutDashboard,  key: 'home'     },
  { to: '/recipes',   icon: UtensilsCrossed,  key: 'recipes'  },
  { to: '/chat',      icon: Bot,              key: 'agent'    },
  { to: '/shopping',  icon: ShoppingCart,     key: 'shopping' },
  { to: '/settings',  icon: Settings,         key: 'settings' },
]

export function BottomNav() {
  const { t } = useTranslation()
  const { location } = useRouterState()
  const currentPath = location.pathname

  // ChatPage has its own full-screen layout with back button — no nav needed
  if (currentPath === '/chat') return null

  return (
    <nav
      className="flex lg:hidden items-start justify-around bg-card border-t border-border/60 shadow-[0_-1px_0_rgba(28,22,18,0.06)] px-1 shrink-0"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
    >
      {NAV_ITEMS.map(({ to, icon: Icon, key }) => {
        const isActive = currentPath.startsWith(to)
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              // 44 px minimum touch target: pt-2.5 (10px) + 22px icon + gap + label ≈ 54px
              'flex flex-col items-center gap-[3px] pt-2.5 pb-1 px-4 rounded-xl transition-colors min-w-[44px]',
              isActive ? 'text-[#C97B5C]' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.2 : 1.8} />
            <span className="text-[10.5px] font-medium leading-none tracking-[0.01em]">{t(`nav.${key}`)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
