import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BatchRow } from './BatchRow'
import { ExpiryBadge } from './ExpiryBadge'
import type { InventoryGroupResponse } from '@/shared/lib/api.types'
import { formatQuantity } from '@/shared/lib/utils'
import { cn } from '@/lib/utils'

export const CATEGORY_COLORS: Record<string, string> = {
  dairy:     '#0EA5E9',
  meat:      '#EF4444',
  vegetable: '#22C55E',
  fruit:     '#22C55E',
  pantry:    '#92400E',
  beverage:  '#8B5CF6',
  snack:     '#F97316',
}

export function getCategoryColor(category: string | null | undefined): string {
  if (!category) return '#A8A29E'
  return CATEGORY_COLORS[category.toLowerCase()] ?? '#A8A29E'
}

interface ItemGroupCardProps {
  group: InventoryGroupResponse
  delay?: number
}

export function ItemGroupCard({ group, delay = 0 }: ItemGroupCardProps) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  // Determine worst expiry status across batches
  const worstDate = group.batches
    .filter((b) => b.expiry_date)
    .sort((a, b) => (a.expiry_date! < b.expiry_date! ? -1 : 1))[0]?.expiry_date ?? null

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="bg-card border border-border rounded-xl overflow-hidden transition-shadow hover:shadow-md cursor-pointer"
      style={{ borderLeft: `4px solid ${getCategoryColor(group.batches[0]?.category)}` }}
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className={cn(
              'text-sm font-semibold text-foreground capitalize min-w-0',
              expanded ? 'break-words line-clamp-3' : 'truncate'
            )}>
              {group.item_name}
            </span>
            <ExpiryBadge date={worstDate} className="shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('inventory.batch', { count: group.batches.length })} ·{' '}
            {formatQuantity(group.total_quantity, group.unit)} {t('inventory.total')}
          </p>
        </div>

        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="text-muted-foreground shrink-0"
        >
          <ChevronDown className="w-4 h-4" />
        </motion.div>
      </button>

      {/* Expandable batches */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="batches"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-border px-2 py-1 flex flex-col">
              {group.batches.map((batch) => (
                <BatchRow key={batch.id} batch={batch} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
