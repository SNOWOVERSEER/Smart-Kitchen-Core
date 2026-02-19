import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutDashboard, History, ScanBarcode, Settings, ChefHat } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/',        icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/history', icon: History,         label: 'History'   },
  { to: '/barcode', icon: ScanBarcode,     label: 'Scan'      },
  { to: '/settings',icon: Settings,        label: 'Settings'  },
]

export function Sidebar() {
  const { location } = useRouterState()
  const currentPath = location.pathname

  return (
    <aside className="hidden lg:flex flex-col items-center w-20 h-full bg-card py-6 gap-2 shrink-0 shadow-[2px_0_12px_rgba(28,22,18,0.06)]">
      {/* Logo + brand name */}
      <div className="flex flex-col items-center gap-1 mb-4">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-xl"
          style={{ backgroundColor: '#C97B5C' }}
        >
          <ChefHat className="w-5 h-5 text-white" />
        </div>
        <span className="text-[8px] uppercase tracking-widest text-muted-foreground leading-tight text-center">
          Smart<br />Kitchen
        </span>
      </div>

      {/* Nav items */}
      {navItems.map(({ to, icon: Icon, label }) => {
        const isActive = to === '/' ? currentPath === '/' : currentPath.startsWith(to)
        return (
          <Link
            key={to}
            to={to}
            title={label}
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
