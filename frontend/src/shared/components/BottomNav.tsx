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
    <nav className="flex lg:hidden items-center justify-around h-16 bg-card shadow-[0_-2px_12px_rgba(28,22,18,0.06)] px-2 shrink-0">
      {NAV_ITEMS.map(({ to, icon: Icon, key }) => {
        const isActive = currentPath.startsWith(to)
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors',
              isActive ? 'text-[#C97B5C]' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px]">{t(`nav.${key}`)}</span>
          </Link>
        )
      })}
    </nav>
  )
}
