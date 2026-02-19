import { cn } from '@/lib/utils'
import { expiryStatus, expiryLabel } from '@/shared/lib/utils'

interface ExpiryBadgeProps {
  date: string | null
  className?: string
}

export function ExpiryBadge({ date, className }: ExpiryBadgeProps) {
  const status = expiryStatus(date)
  const label = expiryLabel(date)

  return (
    <span
      className={cn(
        'inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full',
        status === 'critical' && 'bg-red-50 text-red-600',
        status === 'warning' && 'bg-amber-50 text-amber-600',
        status === 'safe' && 'bg-green-50 text-green-700',
        status === 'none' && 'bg-muted text-muted-foreground',
        className
      )}
    >
      {label}
    </span>
  )
}
