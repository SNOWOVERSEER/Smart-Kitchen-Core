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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { AddInventoryRequest } from '@/shared/lib/api.types'
import { addInventoryItem } from '../api'
import { queryClient } from '@/shared/lib/queryClient'

interface AddItemSheetProps {
  open: boolean
  onClose: () => void
  prefill?: Partial<AddInventoryRequest>
}

const UNITS      = ['L', 'ml', 'kg', 'g', 'pcs', 'pack', 'bottle', 'can']
const LOCATIONS  = ['Fridge', 'Freezer', 'Pantry', 'Counter']
const CATEGORIES = ['Dairy', 'Meat', 'Vegetable', 'Fruit', 'Pantry', 'Beverage', 'Snack', 'Other']

interface FormState {
  item_name: string
  brand: string
  // ── Quantity ──
  // Unopened mode: pkg_size × count  →  quantity = total_volume = product
  // Opened mode:   remaining         →  quantity; pkg_size → total_volume
  pkg_size:  string   // size per package (or original pkg size when opened)
  count:     string   // number of packages (unused in opened mode)
  remaining: string   // used only in opened mode
  unit: string
  is_open: boolean
  // ── Storage ──
  category:    string
  expiry_date: string
  location: string
}

type Errors = Partial<Record<keyof FormState, string>>

function buildInitial(prefill?: Partial<AddInventoryRequest>): FormState {
  return {
    item_name:  prefill?.item_name  ?? '',
    brand:      prefill?.brand      ?? '',
    pkg_size:   prefill?.total_volume != null ? String(prefill.total_volume) : '',
    count:      '1',
    remaining:  prefill?.quantity   != null ? String(prefill.quantity)      : '',
    unit:       prefill?.unit       ?? 'pcs',
    is_open:    prefill?.is_open    ?? false,
    category:   prefill?.category   ?? '',
    expiry_date: prefill?.expiry_date ?? '',
    location:   prefill?.location   ?? 'Fridge',
  }
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  )
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-destructive mt-0.5">{msg}</p>
}

export function AddItemSheet({ open, onClose, prefill }: AddItemSheetProps) {
  const [isPending, setIsPending] = useState(false)
  const [form, setForm]           = useState<FormState>(() => buildInitial(prefill))
  const [errors, setErrors]       = useState<Errors>({})

  // Reset whenever the sheet opens
  useEffect(() => {
    if (open) {
      setForm(buildInitial(prefill))
      setErrors({})
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }))
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: undefined }))
  }

  // Auto-computed total for unopened mode
  const computedTotal = (): string => {
    const size = parseFloat(form.pkg_size)
    const cnt  = parseFloat(form.count)
    if (!form.pkg_size || !form.count || isNaN(size) || isNaN(cnt) || size <= 0 || cnt <= 0) return ''
    const total = Math.round(size * cnt * 1000) / 1000
    return `${total} ${form.unit}`
  }

  const validate = (): boolean => {
    const e: Errors = {}
    if (!form.item_name.trim()) {
      e.item_name = 'Item name is required'
    }
    if (!form.unit) {
      e.unit = 'Unit is required'
    }
    if (!form.location) {
      e.location = 'Location is required'
    }

    if (!form.is_open) {
      // Unopened mode
      const size = parseFloat(form.pkg_size)
      if (!form.pkg_size || isNaN(size) || size <= 0) {
        e.pkg_size = 'Enter a size greater than 0'
      }
      const cnt = parseFloat(form.count)
      if (!form.count || isNaN(cnt) || cnt <= 0) {
        e.count = 'Enter a count greater than 0'
      }
    } else {
      // Opened mode
      const rem = parseFloat(form.remaining)
      if (!form.remaining || isNaN(rem) || rem < 0) {
        e.remaining = 'Enter the remaining amount (0 or more)'
      }
      if (form.pkg_size) {
        const size = parseFloat(form.pkg_size)
        if (isNaN(size) || size <= 0) e.pkg_size = 'Must be greater than 0'
      }
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsPending(true)
    try {
      const base: AddInventoryRequest = {
        item_name:   form.item_name.trim(),
        brand:       form.brand.trim() || undefined,
        quantity:    0,
        total_volume: 0,
        unit:        form.unit,
        category:    form.category   || undefined,
        expiry_date: form.expiry_date || undefined,
        is_open:     form.is_open,
        location:    form.location,
      }

      if (!form.is_open) {
        // Each unit is a separate physical item — add N individual batches
        const pkgSize = parseFloat(form.pkg_size)
        const count   = Math.max(1, Math.round(parseFloat(form.count) || 1))
        const payload = { ...base, quantity: pkgSize, total_volume: pkgSize }
        await Promise.all(Array.from({ length: count }, () => addInventoryItem(payload)))
        const label = count > 1
          ? `Added ${count} × ${pkgSize} ${form.unit} ${base.item_name}`
          : `${base.item_name} added`
        toast.success(label)
      } else {
        // Opened / partial — single batch
        const remaining   = parseFloat(form.remaining)
        const total_volume = form.pkg_size ? parseFloat(form.pkg_size) : remaining
        await addInventoryItem({ ...base, quantity: remaining, total_volume })
        toast.success(`${base.item_name} added`)
      }

      void queryClient.invalidateQueries({ queryKey: ['inventory'] })
      onClose()
    } catch {
      toast.error('Failed to add item')
    } finally {
      setIsPending(false)
    }
  }

  const total = computedTotal()

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[420px] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
          <SheetTitle className="text-base">Add inventory item</SheetTitle>
          <SheetDescription className="text-xs">
            Add a new batch to your kitchen inventory.
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
                <FieldLabel required>Item name</FieldLabel>
                <Input
                  value={form.item_name}
                  onChange={(e) => set('item_name', e.target.value)}
                  placeholder="e.g. Milk"
                  className={cn('h-10', errors.item_name && 'border-destructive')}
                />
                <FieldError msg={errors.item_name} />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                      {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="h-px bg-border" />

            {/* ── Quantity ── */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-foreground uppercase tracking-widest">
                  Quantity
                </p>
                {/* Opened toggle lives here so it directly controls the fields below */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Already opened?</span>
                  <Switch
                    checked={form.is_open}
                    onCheckedChange={(v) => set('is_open', v)}
                  />
                </div>
              </div>

              {!form.is_open ? (
                /* ── Unopened: pkg_size × count ── */
                <>
                  <div className="flex gap-3">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <FieldLabel required>Size per package</FieldLabel>
                      <Input
                        inputMode="decimal"
                        value={form.pkg_size}
                        onChange={(e) => set('pkg_size', e.target.value)}
                        placeholder="e.g. 2"
                        className={cn('h-10', errors.pkg_size && 'border-destructive')}
                      />
                      <FieldError msg={errors.pkg_size} />
                    </div>
                    <div className="flex flex-col gap-1.5 w-28">
                      <FieldLabel required>Unit</FieldLabel>
                      <Select value={form.unit} onValueChange={(v) => set('unit', v)}>
                        <SelectTrigger className={cn('h-10', errors.unit && 'border-destructive')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FieldError msg={errors.unit} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <FieldLabel>Count</FieldLabel>
                    <Input
                      inputMode="numeric"
                      value={form.count}
                      onChange={(e) => set('count', e.target.value)}
                      placeholder="1"
                      className={cn('h-10', errors.count && 'border-destructive')}
                    />
                    <FieldError msg={errors.count} />
                  </div>

                  {/* Auto-total chip */}
                  {total && (
                    <div className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-lg">
                      <span className="text-xs text-muted-foreground">Total:</span>
                      <span className="text-sm font-semibold text-foreground">{total}</span>
                    </div>
                  )}
                </>
              ) : (
                /* ── Opened: remaining + optional original size ── */
                <>
                  <div className="flex gap-3">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <FieldLabel required>Remaining amount</FieldLabel>
                      <Input
                        inputMode="decimal"
                        value={form.remaining}
                        onChange={(e) => set('remaining', e.target.value)}
                        placeholder="e.g. 1.5"
                        className={cn('h-10', errors.remaining && 'border-destructive')}
                      />
                      <FieldError msg={errors.remaining} />
                    </div>
                    <div className="flex flex-col gap-1.5 w-28">
                      <FieldLabel required>Unit</FieldLabel>
                      <Select value={form.unit} onValueChange={(v) => set('unit', v)}>
                        <SelectTrigger className={cn('h-10', errors.unit && 'border-destructive')}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <FieldError msg={errors.unit} />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <FieldLabel>Original package size (optional)</FieldLabel>
                    <Input
                      inputMode="decimal"
                      value={form.pkg_size}
                      onChange={(e) => set('pkg_size', e.target.value)}
                      placeholder={form.remaining || 'same as remaining'}
                      className={cn('h-10', errors.pkg_size && 'border-destructive')}
                    />
                    <FieldError msg={errors.pkg_size} />
                    <p className="text-[11px] text-muted-foreground">
                      Sets the 100% mark on the usage bar.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* ── Storage ── */}
            <div className="flex flex-col gap-4">
              <p className="text-xs font-semibold text-foreground uppercase tracking-widest">
                Storage
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <FieldLabel required>Location</FieldLabel>
                  <Select value={form.location} onValueChange={(v) => set('location', v)}>
                    <SelectTrigger className={cn('h-10', errors.location && 'border-destructive')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATIONS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
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
            </div>
          </div>

          {/* Sticky footer */}
          <div className="px-6 py-4 border-t border-border bg-card shrink-0 flex gap-3">
            <Button type="button" variant="outline" className="flex-1 h-10" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1 h-10" disabled={isPending}>
              {isPending ? 'Adding...' : 'Add item'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
