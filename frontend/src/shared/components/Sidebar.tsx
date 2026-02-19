import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutDashboard, History, ScanBarcode, Settings, ChefHat } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/history', icon: History, label: 'History' },
  { to: '/barcode', icon: ScanBarcode, label: 'Scan' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const { location } = useRouterState()
  const currentPath = location.pathname

  return (
    <aside className="hidden lg:flex flex-col items-center w-[72px] h-full bg-card border-r border-border py-6 gap-2 shrink-0">
      {/* Logo */}
      <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-foreground mb-4">
        <ChefHat className="w-5 h-5 text-background" />
      </div>

      {/* Nav items */}
      {navItems.map(({ to, icon: Icon, label }) => {
        const isActive =
          to === '/' ? currentPath === '/' : currentPath.startsWith(to)
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-colors',
              isActive
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            title={label}
          >
            <Icon className="w-5 h-5" />
          </Link>
        )
      })}
    </aside>
  )
}
