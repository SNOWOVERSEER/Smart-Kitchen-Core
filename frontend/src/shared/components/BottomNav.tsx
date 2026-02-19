import { Link, useRouterState } from '@tanstack/react-router'
import { LayoutDashboard, ScanBarcode, Bot, History, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/',        icon: LayoutDashboard, label: 'Home'    },
  { to: '/barcode', icon: ScanBarcode,     label: 'Scan'    },
  { to: '/chat',    icon: Bot,             label: 'Agent'   },
  { to: '/history', icon: History,         label: 'History' },
  { to: '/settings',icon: Settings,        label: 'Settings'},
]

export function BottomNav() {
  const { location } = useRouterState()
  const currentPath = location.pathname

  // ChatPage has its own full-screen layout with back button — no nav needed
  if (currentPath === '/chat') return null

  return (
    <nav className="flex lg:hidden items-center justify-around h-16 bg-card border-t border-border px-2 shrink-0">
      {navItems.map(({ to, icon: Icon, label }) => {
        const isActive = to === '/' ? currentPath === '/' : currentPath.startsWith(to)
        return (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors',
              isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px]">{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
