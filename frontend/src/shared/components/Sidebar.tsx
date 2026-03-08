import type { ElementType } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutDashboard, History, ScanBarcode, Settings, UtensilsCrossed, ShoppingCart, CalendarDays, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useSubscriptionStore } from '@/shared/stores/subscriptionStore'

const NAV_ITEMS: { to: string; icon: ElementType; key: string }[] = [
  { to: '/dashboard', icon: LayoutDashboard,  key: 'dashboard' },
  { to: '/recipes',   icon: UtensilsCrossed,  key: 'recipes'   },
  { to: '/meals',     icon: CalendarDays,    key: 'meals'     },
  { to: '/shopping',  icon: ShoppingCart,     key: 'shopping'  },
  { to: '/history',   icon: History,          key: 'history'   },
  { to: '/barcode',   icon: ScanBarcode,      key: 'scan'      },
  { to: '/settings',  icon: Settings,         key: 'settings'  },
]

function TierBadge() {
  const { t } = useTranslation()
  const tier = useSubscriptionStore((s) => s.tier)
  const hasApiKey = useSubscriptionStore((s) => s.hasApiKey)
  const totalCredits = useSubscriptionStore((s) => s.totalCredits)
  const loaded = useSubscriptionStore((s) => s.loaded)

  if (!loaded) return null

  const planConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
    free: { label: t('subscription.tierFree'), bg: 'bg-zinc-50', text: 'text-zinc-600', border: 'border-zinc-200' },
    supporter: { label: t('subscription.tierSupporter'), bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  }
  const c = planConfig[tier] ?? planConfig.free

  return (
    <Link to="/settings" className="flex flex-col items-center gap-1 mb-1 group">
      <span className={cn('text-[9px] font-semibold rounded-full px-2 py-0.5 border leading-none', c.bg, c.text, c.border)}>
        {c.label}
      </span>
      {hasApiKey ? (
        <span className="text-[9px] font-semibold text-emerald-600 group-hover:text-emerald-700 transition-colors">
          BYOK
        </span>
      ) : (
        <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
          {totalCredits} <Sparkles className="w-2.5 h-2.5 inline -mt-0.5" />
        </span>
      )}
    </Link>
  )
}

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

      {/* Spacer */}
      <div className="flex-1" />

      {/* Subscription tier badge */}
      <TierBadge />
    </aside>
  )
}
