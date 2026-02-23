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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTranslation } from 'react-i18next'
import type { ShoppingItem } from '@/shared/lib/api.types'
import { useCompleteShopping } from '../hooks/useShoppingList'

const LOCATIONS = ['Fridge', 'Freezer', 'Pantry']

interface Props {
  open: boolean
  onClose: () => void
  checkedItems: ShoppingItem[]
}

export function CompleteShoppingSheet({ open, onClose, checkedItems }: Props) {
  const { t } = useTranslation()
  const [defaultLocation, setDefaultLocation] = useState('Fridge')
  const complete = useCompleteShopping()

  const handleSubmit = () => {
    const ids = checkedItems.map((item) => item.id)
    complete.mutate(
      { item_ids: ids, default_location: defaultLocation },
      { onSuccess: () => onClose() }
    )
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[420px] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-base">
            {t('shopping.completeShoppingTitle')}
          </SheetTitle>
          <SheetDescription className="text-xs">
            {t('shopping.completeShoppingDescription')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-6">
          {/* Checked items list */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-foreground uppercase tracking-widest">
              {t('shopping.items')}
            </p>
            <ul className="flex flex-col gap-1">
              {checkedItems.map((item) => (
                <li key={item.id} className="text-sm text-foreground py-1 border-b border-border last:border-b-0">
                  {item.item_name}
                  {item.quantity != null && item.unit && (
                    <span className="text-muted-foreground ml-2 text-xs">
                      {item.quantity} {item.unit}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="h-px bg-border" />

          {/* Default location selector */}
          <div className="flex flex-col gap-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t('shopping.defaultLocation')}
            </Label>
            <Select value={defaultLocation} onValueChange={setDefaultLocation}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCATIONS.map((loc) => (
                  <SelectItem key={loc} value={loc}>
                    {loc}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="px-6 py-4 border-t border-border bg-card shrink-0 flex gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-10"
            onClick={onClose}
            disabled={complete.isPending}
          >
            {t('shopping.cancel')}
          </Button>
          <Button
            type="button"
            className="flex-1 h-10"
            onClick={handleSubmit}
            disabled={complete.isPending || checkedItems.length === 0}
          >
            {complete.isPending
              ? t('shopping.completing')
              : t('shopping.completeShoppingButton')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
