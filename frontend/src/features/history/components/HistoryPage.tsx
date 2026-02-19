import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Download, History } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { TopBar } from '@/shared/components/TopBar'
import { getLogs } from '../api'
import type { TransactionIntent } from '@/shared/lib/api.types'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const INTENT_CONFIG: Record<TransactionIntent, { badge: string; label: string }> = {
  INBOUND:  { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'Inbound'  },
  CONSUME:  { badge: 'bg-blue-50   text-blue-700   border-blue-200',   label: 'Consume'  },
  DISCARD:  { badge: 'bg-red-50    text-red-600    border-red-200',     label: 'Discard'  },
}

type DateFilter = '7d' | '30d' | 'all'

function withinDays(dateStr: string | null, days: number): boolean {
  if (!dateStr) return false
  return (Date.now() - new Date(dateStr).getTime()) / 86_400_000 <= days
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const date = d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
  return `${date} ${time}`
}

// Extract the primary item name + optional brand from operation_details
function getItem(details: Record<string, unknown> | null): { name: string; brand: string | null } {
  if (!details) return { name: '—', brand: null }
  const name = (details.item_name as string | undefined) ?? '—'
  // INBOUND stores brand directly; CONSUME stores brand_filter
  const brand =
    (details.brand as string | null | undefined) ??
    (details.brand_filter as string | null | undefined) ??
    null
  return { name, brand }
}

// Build a concise human-readable action string
function getAction(
  intent: TransactionIntent,
  details: Record<string, unknown> | null
): { text: string; className: string } {
  if (!details) return { text: '—', className: 'text-muted-foreground' }

  switch (intent) {
    case 'INBOUND': {
      const qty  = details.quantity as number | undefined
      const unit = details.unit    as string | undefined
      return {
        text: qty != null ? `+${qty}${unit ? ' ' + unit : ''}` : 'Added',
        className: 'text-emerald-600 font-medium',
      }
    }
    case 'CONSUME': {
      const amount = details.consumed_amount as number | undefined
      const batches = details.affected_batches as Array<{ deducted: number }> | undefined
      const total = amount ?? batches?.reduce((s, b) => s + b.deducted, 0)
      return {
        text: total != null ? `−${total}` : 'Consumed',
        className: 'text-blue-600 font-medium',
      }
    }
    case 'DISCARD': {
      const leftover = details.remaining_quantity as number | undefined
      const unit     = details.unit              as string | undefined
      const qty = leftover != null
        ? `${leftover}${unit ? ' ' + unit : ''}`
        : null
      return {
        text: qty ? `Wasted ${qty}` : 'Removed',
        className: 'text-red-600 font-medium',
      }
    }
  }
}

export function HistoryPage() {
  const [intentFilter, setIntentFilter] = useState<'all' | TransactionIntent>('all')
  const [dateFilter,   setDateFilter  ] = useState<DateFilter>('all')

  const { data: logs, isLoading } = useQuery({
    queryKey: ['logs'],
    queryFn: () => getLogs(200),
  })

  const filtered = useMemo(() => {
    if (!logs) return []
    return logs.filter((log) => {
      const matchIntent = intentFilter === 'all' || log.intent === intentFilter
      const matchDate =
        dateFilter === 'all' ||
        (dateFilter === '7d'  && withinDays(log.created_at, 7))  ||
        (dateFilter === '30d' && withinDays(log.created_at, 30))
      return matchIntent && matchDate
    })
  }, [logs, intentFilter, dateFilter])

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `smart-kitchen-history-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar title="History" />

      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 lg:py-6">

        {/* Filters row */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Tabs value={intentFilter} onValueChange={(v) => setIntentFilter(v as typeof intentFilter)}>
            <TabsList className="h-8">
              <TabsTrigger value="all"     className="text-xs px-2.5 h-6">All</TabsTrigger>
              <TabsTrigger value="INBOUND" className="text-xs px-2.5 h-6">Inbound</TabsTrigger>
              <TabsTrigger value="CONSUME" className="text-xs px-2.5 h-6">Consume</TabsTrigger>
              <TabsTrigger value="DISCARD" className="text-xs px-2.5 h-6">Discard</TabsTrigger>
            </TabsList>
          </Tabs>

          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="all">All time</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" />
            Export
          </Button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
        )}

        {/* Empty */}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <History className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No transactions found</p>
            <p className="text-xs text-muted-foreground mt-1">Try changing the filters</p>
          </div>
        )}

        {/* Table */}
        {!isLoading && filtered.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">

            {/* Desktop header — hidden on mobile */}
            <div className="hidden sm:grid grid-cols-[72px_140px_100px_1fr_110px] gap-4 px-4 py-2.5 border-b border-border bg-muted/30">
              {['TYPE', 'ITEM', 'ACTION', 'USER INPUT', 'DATE'].map((h) => (
                <span key={h} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {h}
                </span>
              ))}
            </div>

            <div className="divide-y divide-border">
              {filtered.map((log, i) => {
                const item   = getItem(log.operation_details)
                const action = getAction(log.intent, log.operation_details)
                const cfg    = INTENT_CONFIG[log.intent]

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.025 }}
                    className="px-4 py-3 hover:bg-muted/30 transition-colors"
                  >
                    {/* Desktop row */}
                    <div className="hidden sm:grid grid-cols-[72px_140px_100px_1fr_110px] gap-4 items-center">
                      <Badge variant="outline" className={cn('text-[10px] font-medium w-fit', cfg.badge)}>
                        {cfg.label}
                      </Badge>

                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                        {item.brand && (
                          <p className="text-[11px] text-muted-foreground">{item.brand}</p>
                        )}
                      </div>

                      <span className={cn('text-sm tabular-nums', action.className)}>
                        {action.text}
                      </span>

                      <div className="min-w-0">
                        {log.raw_input ? (
                          <p className="text-xs text-muted-foreground truncate italic">
                            "{log.raw_input}"
                          </p>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            Manual
                          </span>
                        )}
                      </div>

                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>

                    {/* Mobile card */}
                    <div className="sm:hidden flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn('text-[10px] font-medium', cfg.badge)}>
                            {cfg.label}
                          </Badge>
                          <span className="text-sm font-medium text-foreground">
                            {item.name}{item.brand ? ` · ${item.brand}` : ''}
                          </span>
                        </div>
                        <span className={cn('text-sm tabular-nums shrink-0', action.className)}>
                          {action.text}
                        </span>
                      </div>
                      {log.raw_input ? (
                        <p className="text-xs text-muted-foreground italic">"{log.raw_input}"</p>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                          Manual
                        </span>
                      )}
                      <p className="text-[11px] text-muted-foreground">
                        {formatDateTime(log.created_at)}
                      </p>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
