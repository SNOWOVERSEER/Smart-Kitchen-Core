import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  Download,
  History,
  RefreshCw,
  Package,
  ChefHat,
  ShoppingCart,
  UtensilsCrossed,
  Bot,
  Hand,
  BookOpen,
  ScanBarcode,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TopBar } from '@/shared/components/TopBar'
import { DesktopPageHeader } from '@/shared/components/DesktopPageHeader'
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

// ── Intent metadata ──

type IntentCategory = 'all' | 'inventory' | 'recipe' | 'shopping' | 'meal'

const INTENT_TO_CATEGORY: Record<TransactionIntent, IntentCategory> = {
  INBOUND: 'inventory',
  CONSUME: 'inventory',
  DISCARD: 'inventory',
  UPDATE:  'inventory',
  RECIPE_SAVE:   'recipe',
  RECIPE_DELETE:  'recipe',
  SHOPPING_ADD:      'shopping',
  SHOPPING_UPDATE:   'shopping',
  SHOPPING_DELETE:   'shopping',
  SHOPPING_COMPLETE: 'shopping',
  MEAL_CREATE:   'meal',
  MEAL_UPDATE:   'meal',
  MEAL_DELETE:   'meal',
  MEAL_SCHEDULE: 'meal',
}

const INTENT_COLORS: Record<TransactionIntent, string> = {
  INBOUND:  '#6B7B3C',
  CONSUME:  '#0EA5E9',
  DISCARD:  '#DC2626',
  UPDATE:   '#D97706',
  RECIPE_SAVE:    '#8B5CF6',
  RECIPE_DELETE:   '#EF4444',
  SHOPPING_ADD:       '#14B8A6',
  SHOPPING_UPDATE:    '#D97706',
  SHOPPING_DELETE:    '#EF4444',
  SHOPPING_COMPLETE:  '#059669',
  MEAL_CREATE:    '#F59E0B',
  MEAL_UPDATE:    '#D97706',
  MEAL_DELETE:    '#EF4444',
  MEAL_SCHEDULE:  '#6366F1',
}

// Source tag colors
const SOURCE_STYLES: Record<string, string> = {
  manual:   'bg-stone-100 text-stone-600 border-stone-200',
  agent:    'bg-violet-50 text-violet-700 border-violet-200',
  shopping: 'bg-teal-50 text-teal-700 border-teal-200',
  meal:     'bg-amber-50 text-amber-700 border-amber-200',
  recipe:   'bg-purple-50 text-purple-700 border-purple-200',
  barcode:  'bg-sky-50 text-sky-700 border-sky-200',
}

const SOURCE_ICONS: Record<string, typeof Bot> = {
  manual:   Hand,
  agent:    Bot,
  shopping: ShoppingCart,
  meal:     UtensilsCrossed,
  recipe:   BookOpen,
  barcode:  ScanBarcode,
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

function relativeTime(dateStr: string | null, t: TFunction): string {
  if (!dateStr) return '—'
  const diff = (Date.now() - new Date(dateStr).getTime()) / 1000
  if (diff < 60)    return t('history.justNow')
  if (diff < 3600)  return t('history.minutesAgo', { n: Math.floor(diff / 60) })
  if (diff < 86400) return t('history.hoursAgo', { n: Math.floor(diff / 3600) })
  const days = Math.floor(diff / 86400)
  if (days < 30) return t('history.daysAgo', { n: days })
  return formatDateTime(dateStr)
}

// Extract item name for display
function getItemDisplay(
  intent: TransactionIntent,
  details: Record<string, unknown> | null,
  t: TFunction,
): { name: string; sub: string | null } {
  if (!details) return { name: '—', sub: null }

  switch (intent) {
    case 'INBOUND':
    case 'CONSUME':
    case 'DISCARD':
    case 'UPDATE': {
      const name = (details.item_name as string | undefined) ?? '—'
      const brand =
        (details.brand as string | null | undefined) ??
        (details.brand_filter as string | null | undefined) ??
        null
      return { name, sub: brand }
    }
    case 'RECIPE_SAVE':
    case 'RECIPE_DELETE':
      return {
        name: (details.title as string | undefined) ?? '—',
        sub: details.source_mode ? String(details.source_mode) : null,
      }
    case 'SHOPPING_ADD': {
      const names = details.item_names as string[] | undefined
      const itemName = (details.item_name as string | undefined)
      if (names && names.length > 1) {
        return {
          name: `${names[0]} +${names.length - 1}`,
          sub: (details.source_recipe_title as string | null) ?? null,
        }
      }
      return {
        name: itemName ?? names?.[0] ?? '—',
        sub: (details.source_recipe_title as string | null) ?? null,
      }
    }
    case 'SHOPPING_UPDATE':
      return {
        name: (details.item_name as string | undefined) ?? '—',
        sub: null,
      }
    case 'SHOPPING_DELETE': {
      const delNames = details.item_names as string[] | undefined
      const delName = details.item_name as string | undefined
      const delCount = details.count as number | undefined
      if (delNames && delNames.length > 1) {
        return { name: `${delNames[0]} +${delNames.length - 1}`, sub: null }
      }
      if (delCount && delCount > 1) {
        return { name: `${delCount} ${t('history.items')}`, sub: null }
      }
      return { name: delName ?? '—', sub: null }
    }
    case 'SHOPPING_COMPLETE':
      return {
        name: t('history.shoppingCompleted', `${details.added_count ?? 0} items`),
        sub: null,
      }
    case 'MEAL_CREATE':
    case 'MEAL_UPDATE':
    case 'MEAL_DELETE':
    case 'MEAL_SCHEDULE':
      return {
        name: (details.name as string | undefined) ?? '—',
        sub: details.meal_type ? String(details.meal_type) : null,
      }
  }
}

// Build action text
function getAction(
  intent: TransactionIntent,
  details: Record<string, unknown> | null,
  t: TFunction,
): { text: string; className: string } {
  if (!details) return { text: '—', className: 'text-muted-foreground' }

  switch (intent) {
    case 'INBOUND': {
      const qty  = details.quantity as number | undefined
      const unit = details.unit    as string | undefined
      return {
        text: qty != null ? `+${qty}${unit ? ' ' + unit : ''}` : t('history.added'),
        className: 'text-emerald-600 font-medium',
      }
    }
    case 'CONSUME': {
      const amount = details.consumed_amount as number | undefined
      const batches = details.affected_batches as Array<{ deducted: number }> | undefined
      const total = amount ?? batches?.reduce((s, b) => s + b.deducted, 0)
      const unit = details.unit as string | undefined
      return {
        text: total != null ? `−${total}${unit ? ' ' + unit : ''}` : t('history.consumed'),
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
        text: qty ? t('history.wasted', { qty }) : t('history.removed'),
        className: 'text-red-600 font-medium',
      }
    }
    case 'UPDATE':
      return { text: t('history.updated'), className: 'text-amber-600 font-medium' }
    case 'RECIPE_SAVE':
      return {
        text: t('history.recipeSaved'),
        className: 'text-violet-600 font-medium',
      }
    case 'RECIPE_DELETE':
      return { text: t('history.recipeDeleted'), className: 'text-red-600 font-medium' }
    case 'SHOPPING_ADD': {
      const count = details.count as number | undefined
      const qty = details.quantity as number | undefined
      const unit = details.unit as string | undefined
      if (count && count > 1) {
        return {
          text: `+${count} ${t('history.items')}`,
          className: 'text-teal-600 font-medium',
        }
      }
      return {
        text: qty != null ? `+${qty}${unit ? ' ' + unit : ''}` : t('history.added'),
        className: 'text-teal-600 font-medium',
      }
    }
    case 'SHOPPING_UPDATE':
      return { text: t('history.updated'), className: 'text-amber-600 font-medium' }
    case 'SHOPPING_DELETE': {
      const delCount = details.count as number | undefined
      return {
        text: delCount && delCount > 1 ? `−${delCount} ${t('history.items')}` : t('history.removed'),
        className: 'text-red-600 font-medium',
      }
    }
    case 'SHOPPING_COMPLETE': {
      const added = details.added_count as number | undefined
      return {
        text: added != null ? `+${added} ${t('history.items')}` : t('history.completed'),
        className: 'text-emerald-600 font-medium',
      }
    }
    case 'MEAL_CREATE':
      return {
        text: t('history.created'),
        className: 'text-amber-600 font-medium',
      }
    case 'MEAL_UPDATE':
      return { text: t('history.updated'), className: 'text-amber-600 font-medium' }
    case 'MEAL_DELETE':
      return { text: t('history.removed'), className: 'text-red-600 font-medium' }
    case 'MEAL_SCHEDULE': {
      const date = details.scheduled_date as string | undefined
      return {
        text: date ?? t('history.scheduled'),
        className: 'text-indigo-600 font-medium',
      }
    }
  }
}

function SourceTag({ source, t }: { source: string; t: TFunction }) {
  const style = SOURCE_STYLES[source] ?? SOURCE_STYLES.manual
  const Icon = SOURCE_ICONS[source] ?? Hand
  const label = t(`history.source_${source}`, source)

  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border',
      style,
    )}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  )
}

const CATEGORY_ICONS: Record<IntentCategory, typeof Package> = {
  all:       History,
  inventory: Package,
  recipe:    ChefHat,
  shopping:  ShoppingCart,
  meal:      UtensilsCrossed,
}

export function HistoryPage() {
  const { t } = useTranslation()
  const [categoryFilter, setCategoryFilter] = useState<IntentCategory>('all')
  const [dateFilter, setDateFilter] = useState<DateFilter>('all')

  const { data: logs, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['logs'],
    queryFn: () => getLogs(200),
  })

  const filtered = useMemo(() => {
    if (!logs) return []
    return logs.filter((log) => {
      const matchCategory =
        categoryFilter === 'all' ||
        INTENT_TO_CATEGORY[log.intent] === categoryFilter
      const matchDate =
        dateFilter === 'all' ||
        (dateFilter === '7d'  && withinDays(log.created_at, 7))  ||
        (dateFilter === '30d' && withinDays(log.created_at, 30))
      return matchCategory && matchDate
    })
  }, [logs, categoryFilter, dateFilter])

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `smart-kitchen-history-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const INTENT_LABELS: Record<TransactionIntent, string> = {
    INBOUND:  t('history.inbound'),
    CONSUME:  t('history.consume'),
    DISCARD:  t('history.discard'),
    UPDATE:   t('history.update'),
    RECIPE_SAVE:    t('history.recipeSave'),
    RECIPE_DELETE:   t('history.recipeDelete'),
    SHOPPING_ADD:       t('history.shoppingAdd'),
    SHOPPING_UPDATE:    t('history.shoppingUpdate'),
    SHOPPING_DELETE:    t('history.shoppingDelete'),
    SHOPPING_COMPLETE:  t('history.shoppingComplete'),
    MEAL_CREATE:    t('history.mealCreate'),
    MEAL_UPDATE:    t('history.mealUpdate'),
    MEAL_DELETE:    t('history.mealDelete'),
    MEAL_SCHEDULE:  t('history.mealSchedule'),
  }

  const CATEGORY_LABELS: Record<IntentCategory, string> = {
    all:       t('history.all'),
    inventory: t('history.catInventory'),
    recipe:    t('history.catRecipe'),
    shopping:  t('history.catShopping'),
    meal:      t('history.catMeal'),
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        actionsOnly
        className="hidden lg:flex fixed top-4 right-4 z-30 rounded-xl border border-stone-200/80 bg-white/90 backdrop-blur-sm px-2 py-1.5 shadow-sm"
      />

      <div className="lg:hidden">
        <TopBar title={t('history.title')} mobileIcon={History} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 lg:py-6">
        <DesktopPageHeader
          icon={History}
          title={t('history.title')}
          className="mb-5"
        />

        {/* Filters row */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {/* Category pills */}
          <div className="flex gap-1.5 flex-wrap">
            {(Object.keys(CATEGORY_LABELS) as IntentCategory[]).map((cat) => {
              const Icon = CATEGORY_ICONS[cat]
              const isActive = categoryFilter === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    'inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-colors cursor-pointer border',
                    isActive
                      ? 'bg-[#1C1612] text-white border-[#1C1612]'
                      : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50',
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {CATEGORY_LABELS[cat]}
                </button>
              )
            })}
          </div>

          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
            <SelectTrigger className="h-8 text-xs w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">{t('history.last7days')}</SelectItem>
              <SelectItem value="30d">{t('history.last30days')}</SelectItem>
              <SelectItem value="all">{t('history.allTime')}</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 h-8"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('w-3.5 h-3.5', isFetching && 'animate-spin')} />
            {t('history.refresh')}
          </Button>

          <Button variant="outline" size="sm" className="gap-1.5 h-8" onClick={handleExport}>
            <Download className="w-3.5 h-3.5" />
            {t('history.export')}
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
            <p className="text-sm font-medium">{t('history.noTransactions')}</p>
            <p className="text-xs text-muted-foreground mt-1">{t('history.tryChangingFilters')}</p>
          </div>
        )}

        {/* Table */}
        {!isLoading && filtered.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">

            {/* Desktop header — hidden on mobile */}
            <div className="hidden sm:grid grid-cols-[90px_160px_100px_1fr_110px] gap-4 px-4 py-2.5 border-b border-border bg-muted/30">
              {[
                t('history.colType'),
                t('history.colItem'),
                t('history.colAction'),
                t('history.colSource'),
                t('history.colDate'),
              ].map((h) => (
                <span key={h} className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {h}
                </span>
              ))}
            </div>

            <div className="divide-y divide-border">
              {filtered.map((log, i) => {
                const item   = getItemDisplay(log.intent, log.operation_details, t)
                const action = getAction(log.intent, log.operation_details, t)
                const label  = INTENT_LABELS[log.intent]
                const source = (log.operation_details?.source as string | undefined)
                  ?? (log.raw_input ? 'agent' : 'manual')

                return (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.02, 0.5) }}
                    className="px-4 py-3.5 hover:bg-muted/30 transition-colors"
                  >
                    {/* Desktop row */}
                    <div className="hidden sm:grid grid-cols-[90px_160px_100px_1fr_110px] gap-4 items-center">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-1 h-8 rounded-full shrink-0"
                          style={{ backgroundColor: INTENT_COLORS[log.intent] }}
                        />
                        <span className="text-xs font-medium text-foreground truncate">{label}</span>
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                        {item.sub && (
                          <p className="text-[11px] text-muted-foreground truncate">{item.sub}</p>
                        )}
                      </div>

                      <span className={cn('text-sm tabular-nums', action.className)}>
                        {action.text}
                      </span>

                      <div className="min-w-0 flex items-center gap-2">
                        <SourceTag source={source} t={t} />
                        {log.raw_input && (
                          <p className="text-xs text-muted-foreground truncate italic flex-1 min-w-0">
                            &ldquo;{log.raw_input}&rdquo;
                          </p>
                        )}
                      </div>

                      <span
                        title={formatDateTime(log.created_at)}
                        className="text-xs text-muted-foreground whitespace-nowrap cursor-default"
                      >
                        {relativeTime(log.created_at, t)}
                      </span>
                    </div>

                    {/* Mobile card */}
                    <div className="sm:hidden flex flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="w-1 h-5 rounded-full shrink-0"
                            style={{ backgroundColor: INTENT_COLORS[log.intent] }}
                          />
                          <span className="text-xs font-medium text-foreground shrink-0">{label}</span>
                          <span className="text-sm font-medium text-foreground truncate">
                            {item.name}{item.sub ? ` · ${item.sub}` : ''}
                          </span>
                        </div>
                        <span className={cn('text-sm tabular-nums shrink-0', action.className)}>
                          {action.text}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <SourceTag source={source} t={t} />
                        {log.raw_input && (
                          <p className="text-xs text-muted-foreground italic truncate flex-1">
                            &ldquo;{log.raw_input}&rdquo;
                          </p>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {relativeTime(log.created_at, t)}
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
