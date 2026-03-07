import type { ElementType } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutDashboard, History, ScanBarcode, Settings, UtensilsCrossed, ShoppingCart, CalendarDays } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

const NAV_ITEMS: { to: string; icon: ElementType; key: string }[] = [
  { to: '/dashboard', icon: LayoutDashboard,  key: 'dashboard' },
  { to: '/recipes',   icon: UtensilsCrossed,  key: 'recipes'   },
  { to: '/meals',     icon: CalendarDays,    key: 'meals'     },
  { to: '/shopping',  icon: ShoppingCart,     key: 'shopping'  },
  { to: '/history',   icon: History,          key: 'history'   },
  { to: '/barcode',   icon: ScanBarcode,      key: 'scan'      },
  { to: '/settings',  icon: Settings,         key: 'settings'  },
]

export function Sidebar() {
  const { t } = useTranslation()
  const { location } = useRouterState()
  const currentPath = location.pathname

  return (
    <aside className="hidden lg:flex flex-col items-center w-20 h-full bg-card py-6 gap-2 shrink-0 shadow-[2px_0_12px_rgba(28,22,18,0.06)]">
      {/* Brand mark */}
      <div className="flex flex-col items-center mb-4">
        <span className="text-[11px] font-bold leading-tight tracking-tight text-foreground" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>Kitchen</span>
        <span className="flex items-center gap-0.5">
          <span className="text-[11px] font-bold leading-tight tracking-tight text-foreground" style={{ fontFamily: '"Playfair Display", Georgia, serif' }}>Loop</span>
          <span className="text-[6px] font-bold text-white w-3 h-3 rounded flex items-center justify-center leading-none" style={{ backgroundColor: '#C97B5C' }}>AI</span>
        </span>
      </div>

      {/* Nav items */}
      {NAV_ITEMS.map(({ to, icon: Icon, key }) => {
        const isActive = currentPath.startsWith(to)
        return (
          <Link
            key={to}
            to={to}
            title={t(`nav.${key}`)}
            className={cn(
              'relative flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-colors',
              isActive
                ? 'bg-accent text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {isActive && (
              <span
                className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full"
                style={{ backgroundColor: '#C97B5C' }}
              />
            )}
            <Icon className="w-5 h-5" />
          </Link>
        )
      })}
    </aside>
  )
}
