import { Bell, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuthStore } from '../stores/authStore'
import { logout } from '@/features/auth/api'
import { useNavigate } from '@tanstack/react-router'

interface TopBarProps {
  searchValue?: string
  onSearchChange?: (value: string) => void
  title?: string
}

export function TopBar({ searchValue, onSearchChange, title }: TopBarProps) {
  const { email, clearAuth } = useAuthStore()
  const navigate = useNavigate()

  const initials = email ? email.slice(0, 2).toUpperCase() : 'SK'

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
      {title && (
        <h1 className="font-semibold text-sm text-foreground mr-2 hidden md:block">{title}</h1>
      )}

      {onSearchChange !== undefined && (
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="pl-8 h-8 text-sm bg-muted border-0"
          />
        </div>
      )}

      <div className="flex-1" />

      <button className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
        <Bell className="w-4 h-4" />
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="outline-none">
            <Avatar className="w-8 h-8 cursor-pointer">
              <AvatarFallback className="text-xs bg-muted text-foreground">{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5">
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => void navigate({ to: '/settings' })}>
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => void handleLogout()}
            className="text-destructive focus:text-destructive"
          >
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
