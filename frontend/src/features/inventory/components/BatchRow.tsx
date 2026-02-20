import { useState } from 'react'
import { getCategoryColor } from './ItemGroupCard'
import { Trash2, PackageOpen, Package, CheckCheck, Pencil } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { Progress } from '@/components/ui/progress'
import { ExpiryBadge } from './ExpiryBadge'
import { EditItemSheet } from './EditItemSheet'
import type { InventoryItemResponse } from '@/shared/lib/api.types'
import { formatQuantity } from '@/shared/lib/utils'
import { useDeleteBatch, useConsumeItem } from '../hooks/useInventory'

interface BatchRowProps {
  batch: InventoryItemResponse
}

export function BatchRow({ batch }: BatchRowProps) {
  const { t } = useTranslation()
  const deleteMutation  = useDeleteBatch()
  const consumeMutation = useConsumeItem()
  const [editOpen, setEditOpen] = useState(false)

  const pct = batch.total_volume > 0 ? (batch.quantity / batch.total_volume) * 100 : 100

  const handleUsedUp = () => {
    consumeMutation.mutate({
      item_name: batch.item_name,
      amount: batch.quantity,
      brand: batch.brand ?? undefined,
    })
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/50 transition-colors group"
      >
        {/* Open/closed icon */}
        <div className="text-muted-foreground shrink-0">
          {batch.is_open ? (
            <PackageOpen className="w-4 h-4 text-amber-500" />
          ) : (
            <Package className="w-4 h-4" />
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground truncate">
              {batch.brand ?? batch.item_name}
            </span>
            <ExpiryBadge date={batch.expiry_date} />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1" style={{ '--progress-color': getCategoryColor(batch.category) } as React.CSSProperties}>
              <Progress value={pct} className="h-1.5" />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatQuantity(batch.quantity, batch.unit)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-medium text-muted-foreground/70 tabular-nums font-mono">#{batch.id}</span>
            <span className="text-[10px] text-muted-foreground">·</span>
            <span className="text-[10px] text-muted-foreground">{batch.location}</span>
            {batch.category && (
              <>
                <span className="text-[10px] text-muted-foreground">·</span>
                <span className="text-[10px] text-muted-foreground">{batch.category}</span>
              </>
            )}
          </div>
        </div>

        {/* Action buttons — visible on hover */}
        <div className="flex items-center gap-1 transition-opacity shrink-0 sm:opacity-0 sm:group-hover:opacity-100">
          {/* Edit */}
          <button
            onClick={() => setEditOpen(true)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={t('inventory.editBatch')}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>

          {/* Used up */}
          <button
            onClick={handleUsedUp}
            disabled={consumeMutation.isPending}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
            title={t('inventory.markAsUsedUp')}
          >
            <CheckCheck className="w-3.5 h-3.5" />
          </button>

          {/* Delete */}
          <button
            onClick={() => deleteMutation.mutate(batch.id)}
            disabled={deleteMutation.isPending}
            className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title={t('inventory.discardBatch')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.div>

      <EditItemSheet
        batch={batch}
        open={editOpen}
        onClose={() => setEditOpen(false)}
      />
    </>
  )
}
