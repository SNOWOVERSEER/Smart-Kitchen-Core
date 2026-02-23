import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { apiClient } from '@/shared/lib/axios'
import type { ShoppingItem } from '@/shared/lib/api.types'

const LOCATIONS = ['Fridge', 'Freezer', 'Pantry'] as const
type Location = (typeof LOCATIONS)[number]

interface Props {
  item: ShoppingItem | null
  open: boolean
  onClose: () => void
}

export function QuickStockSheet({ item, open, onClose }: Props) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [location, setLocation] = useState<Location>('Fridge')
  const [expiryDate, setExpiryDate] = useState('')
  const [isPending, setIsPending] = useState(false)

  async function handleConfirm() {
    if (!item) return
    setIsPending(true)
    try {
      await apiClient.post('/api/v1/inventory', {
        item_name: item.item_name,
        quantity: item.quantity ?? 1,
        total_volume: item.quantity ?? 1,
        unit: item.unit ?? 'pcs',
        location,
        ...(expiryDate ? { expiry_date: expiryDate } : {}),
      })
      await apiClient.delete(`/api/v1/shopping/${item.id}`)
      void qc.invalidateQueries({ queryKey: ['inventory'] })
      void qc.invalidateQueries({ queryKey: ['shopping'] })
      toast.success(t('shopping.quickStockSuccess', { name: item.item_name }))
      setExpiryDate('')
      onClose()
    } catch {
      toast.error(t('shopping.quickStockError'))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-safe">
        <SheetHeader className="mb-4">
          <SheetTitle>{t('shopping.quickStockTitle')}</SheetTitle>
          <SheetDescription>
            {item ? `${item.item_name}${item.quantity != null ? ` · ${item.quantity}${item.unit ? ` ${item.unit}` : ''}` : ''}` : t('shopping.quickStockDescription')}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          {/* Location selector */}
          <div>
            <Label className="text-sm font-medium mb-2 block">{t('inventory.addSheet.storage')}</Label>
            <div className="flex gap-2">
              {LOCATIONS.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocation(loc)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                    location === loc
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-foreground border-border hover:bg-muted'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>

          {/* Expiry date (optional) */}
          <div>
            <Label htmlFor="qs-expiry" className="text-sm font-medium mb-2 block">
              {t('inventory.addSheet.expiryDate')} <span className="text-muted-foreground font-normal">({t('common.optional')})</span>
            </Label>
            <Input
              id="qs-expiry"
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="h-10"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button className="flex-1" onClick={handleConfirm} disabled={isPending || !item}>
            {isPending ? t('common.loading') : t('shopping.quickStockConfirm')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
