import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DesktopPageHeaderProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  rightSlot?: ReactNode
  className?: string
}

export function DesktopPageHeader({
  icon: Icon,
  title,
  subtitle,
  rightSlot,
  className,
}: DesktopPageHeaderProps) {
  return (
    <div className={cn('hidden lg:block', className)}>
      <div className="flex items-end justify-between gap-6">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2.5 rounded-full border border-stone-200/80 bg-white/90 px-2.5 py-1.5 shadow-sm">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
              <Icon className="h-4 w-4" />
            </span>
            <span
              className="text-[1.02rem] text-[#1C1612]"
              style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
            >
              {title}
            </span>
          </div>
          {subtitle && (
            <p className="mt-2 text-sm leading-snug text-stone-500">
              {subtitle}
            </p>
          )}
        </div>

        {rightSlot && (
          <div className="min-w-0 shrink-0">
            {rightSlot}
          </div>
        )}
      </div>

      <div className="mt-3 h-px w-24 rounded-full bg-gradient-to-r from-primary/55 via-primary/20 to-transparent" />
    </div>
  )
}
