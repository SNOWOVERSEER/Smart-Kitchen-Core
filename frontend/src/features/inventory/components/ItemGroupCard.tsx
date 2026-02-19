import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { BatchRow } from './BatchRow'
import { ExpiryBadge } from './ExpiryBadge'
import type { InventoryGroupResponse } from '@/shared/lib/api.types'
import { formatQuantity } from '@/shared/lib/utils'

interface ItemGroupCardProps {
  group: InventoryGroupResponse
  delay?: number
}

export function ItemGroupCard({ group, delay = 0 }: ItemGroupCardProps) {
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
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground capitalize">
              {group.item_name}
            </span>
            <ExpiryBadge date={worstDate} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {group.batches.length} batch{group.batches.length !== 1 ? 'es' : ''} ·{' '}
            {formatQuantity(group.total_quantity, group.unit)} total
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
