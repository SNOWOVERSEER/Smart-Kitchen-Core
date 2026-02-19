import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import type { InventoryItemResponse } from '@/shared/lib/api.types'
import { useUpdateBatch } from '../hooks/useInventory'

interface EditItemSheetProps {
  batch: InventoryItemResponse | null
  open: boolean
  onClose: () => void
}

const LOCATIONS  = ['Fridge', 'Freezer', 'Pantry', 'Counter']
const CATEGORIES = ['Dairy', 'Meat', 'Vegetable', 'Fruit', 'Pantry', 'Beverage', 'Snack', 'Other']

// Numeric fields stored as strings to avoid leading-zero bug
interface FormState {
  quantity:     string
  total_volume: string
  brand:        string
  category:     string
  expiry_date:  string
  is_open:      boolean
  location:     string
}

type Errors = Partial<Record<keyof FormState, string>>

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
      {children}
    </Label>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-destructive mt-0.5">{msg}</p>
}

export function EditItemSheet({ batch, open, onClose }: EditItemSheetProps) {
  const updateMutation = useUpdateBatch()
  const [form, setForm] = useState<FormState>({
    quantity:     '',
    total_volume: '',
    brand:        '',
    category:     '',
    expiry_date:  '',
    is_open:      false,
    location:     'Fridge',
  })
  const [errors, setErrors] = useState<Errors>({})

  // Sync form when batch changes or sheet opens
  useEffect(() => {
    if (open && batch) {
      setForm({
        quantity:     String(batch.quantity),
        total_volume: String(batch.total_volume),
        brand:        batch.brand        ?? '',
        category:     batch.category     ?? '',
        expiry_date:  batch.expiry_date  ?? '',
        is_open:      batch.is_open,
        location:     batch.location,
      })
      setErrors({})
    }
  }, [open, batch])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }))
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }))
  }

  // ── Slider logic ──────────────────────────────────────────────
  const tv  = parseFloat(form.total_volume)
  const qty = parseFloat(form.quantity)
  const canSlide  = !isNaN(tv) && tv > 0
  const sliderPct = canSlide && !isNaN(qty)
    ? Math.min(100, Math.max(0, (qty / tv) * 100))
    : 0

  // Dragging the slider → update quantity + auto-sync is_open
  const handleSliderChange = ([pct]: number[]) => {
    if (!canSlide) return
    // Round to 1 decimal; for small units (ml/g) round to integer
    const raw   = (pct / 100) * tv
    const isInt = ['pcs', 'pack', 'can', 'bottle', 'ml', 'g'].includes(batch?.unit ?? '')
    const value = isInt ? Math.round(raw) : Math.round(raw * 10) / 10
    setForm((prev) => ({ ...prev, quantity: String(value), is_open: pct < 100 }))
    if (errors.quantity) setErrors((prev) => ({ ...prev, quantity: undefined }))
  }

  // Color based on remaining %
  const pctColorClass =
    sliderPct <= 20  ? 'text-red-600'
    : sliderPct <= 50 ? 'text-amber-600'
    : 'text-emerald-600'

  // ── Validation ─────────────────────────────────────────────────
  const validate = (): boolean => {
    const e: Errors = {}
    const q = parseFloat(form.quantity)
    if (form.quantity === '' || isNaN(q) || q < 0) {
      e.quantity = 'Enter a valid quantity (0 or more)'
    }
    const t = parseFloat(form.total_volume)
    if (!form.total_volume || isNaN(t) || t <= 0) {
      e.total_volume = 'Enter a valid total greater than 0'
    }
    if (!form.location) {
      e.location = 'Location is required'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!batch || !validate()) return
    await updateMutation.mutateAsync({
      id: batch.id,
      data: {
        quantity:    parseFloat(form.quantity),
        total_volume: parseFloat(form.total_volume),
        brand:       form.brand.trim() || undefined,
        category:    form.category     || undefined,
        expiry_date: form.expiry_date  || undefined,
        is_open:     form.is_open,
        location:    form.location,
      },
    })
    onClose()
  }

  if (!batch) return null

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[420px] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-base">Edit batch</SheetTitle>
          <SheetDescription className="text-xs">
            {batch.item_name}{batch.brand ? ` · ${batch.brand}` : ''}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          className="flex-1 overflow-y-auto flex flex-col"
        >
          <div className="px-6 py-5 flex flex-col gap-6">

            {/* ── Item Details ── */}
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest">
                Item Details
              </p>

              <div className="flex flex-col gap-1.5">
                <FieldLabel>Brand</FieldLabel>
                <Input
                  value={form.brand}
                  onChange={(e) => set('brand', e.target.value)}
                  placeholder="e.g. A2"
                  className="h-10"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel>Category</FieldLabel>
                <Select value={form.category} onValueChange={(v) => set('category', v)}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* ── Quantity ── */}
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest">
                Quantity
              </p>

              {/* Slider — primary control */}
              <div className="flex flex-col gap-3 py-1">
                <Slider
                  value={[sliderPct]}
                  min={0}
                  max={100}
                  step={1}
                  disabled={!canSlide}
                  onValueChange={handleSliderChange}
                  className="w-full"
                />

                {/* Percentage label + actual value */}
                <div className="flex items-baseline justify-between">
                  <span className={cn('text-2xl font-bold tabular-nums leading-none', pctColorClass)}>
                    {Math.round(sliderPct)}%
                  </span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {form.quantity || '?'} / {form.total_volume || '?'} {batch.unit}
                  </span>
                </div>

                {!canSlide && (
                  <p className="text-xs text-muted-foreground">
                    Set a valid original total below to enable the slider.
                  </p>
                )}
              </div>

              {/* Precise number inputs — secondary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Remaining</FieldLabel>
                  <div className="relative">
                    <Input
                      inputMode="decimal"
                      value={form.quantity}
                      onChange={(e) => {
                        const val    = e.target.value
                        const newQty = parseFloat(val)
                        const curTv  = parseFloat(form.total_volume)
                        setForm((prev) => ({
                          ...prev,
                          quantity: val,
                          is_open: !isNaN(newQty) && !isNaN(curTv) && curTv > 0
                            ? newQty < curTv
                            : prev.is_open,
                        }))
                        if (errors.quantity) setErrors((prev) => ({ ...prev, quantity: undefined }))
                      }}
                      placeholder="0"
                      className={cn('h-10 pr-10', errors.quantity && 'border-destructive')}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                      {batch.unit}
                    </span>
                  </div>
                  <FieldError msg={errors.quantity} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Original total</FieldLabel>
                  <div className="relative">
                    <Input
                      inputMode="decimal"
                      value={form.total_volume}
                      onChange={(e) => set('total_volume', e.target.value)}
                      placeholder="0"
                      className={cn('h-10 pr-10', errors.total_volume && 'border-destructive')}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                      {batch.unit}
                    </span>
                  </div>
                  <FieldError msg={errors.total_volume} />
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* ── Storage ── */}
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest">
                Storage
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Location</FieldLabel>
                  <Select value={form.location} onValueChange={(v) => set('location', v)}>
                    <SelectTrigger className={cn('h-10', errors.location && 'border-destructive')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATIONS.map((l) => (
                        <SelectItem key={l} value={l}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError msg={errors.location} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <FieldLabel>Expiry date</FieldLabel>
                  <Input
                    type="date"
                    value={form.expiry_date}
                    onChange={(e) => set('expiry_date', e.target.value)}
                    className="h-10"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between py-2 px-3 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm font-medium">Currently open?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Open items are consumed first (FEFO)
                  </p>
                </div>
                <Switch
                  checked={form.is_open}
                  onCheckedChange={(v) => set('is_open', v)}
                />
              </div>
            </div>
          </div>

          {/* Sticky footer */}
          <div className="px-6 py-4 border-t border-border bg-card shrink-0 flex gap-3">
            <Button type="button" variant="outline" className="flex-1 h-10" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 h-10" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
