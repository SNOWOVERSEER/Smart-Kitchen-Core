import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ScanBarcode, Search, Package, ExternalLink, Plus, Bot, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { TopBar } from '@/shared/components/TopBar'
import { AddItemSheet } from '@/features/inventory/components/AddItemSheet'
import { lookupBarcode } from '../api'
import type { BarcodeProduct } from '@/shared/lib/api.types'
import toast from 'react-hot-toast'

const RECENT_KEY = 'sk_recent_barcodes'
const MAX_RECENT = 5

function getRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function saveRecent(code: string) {
  const prev = getRecent().filter((c) => c !== code)
  localStorage.setItem(RECENT_KEY, JSON.stringify([code, ...prev].slice(0, MAX_RECENT)))
}

export function BarcodePage() {
  const [manualCode, setManualCode] = useState('')
  const [product, setProduct] = useState<BarcodeProduct | null | false>(null) // null=idle, false=not found
  const [addOpen, setAddOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>(getRecent)
  const [currentCode, setCurrentCode] = useState('')
  const scannerContainerRef = useRef<HTMLDivElement>(null)
  const scanControlsRef = useRef<{ stop: () => void } | null>(null)
  const lastScanned = useRef<string>('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const lookupMutation = useMutation({
    mutationFn: lookupBarcode,
    onSuccess: (data) => {
      if (data.found && data.product) {
        setProduct(data.product)
        setCurrentCode(data.barcode)
        saveRecent(data.barcode)
        setRecent(getRecent())
      } else {
        setProduct(false)
        setCurrentCode(data.barcode)
      }
    },
    onError: () => {
      toast.error('Lookup failed. Check your connection.')
      setProduct(false)
    },
  })

  const handleLookup = useCallback(
    (code: string) => {
      if (!code.trim()) return
      setProduct(null)
      lookupMutation.mutate(code.trim())
    },
    [lookupMutation]
  )

  // Camera scanner setup using @zxing/browser
  useEffect(() => {
    let cancelled = false
    async function startScanner() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        const reader = new BrowserMultiFormatReader()
        const videoEl = document.getElementById('barcode-video') as HTMLVideoElement | null
        if (!videoEl || cancelled) return

        const controls = await reader.decodeFromVideoDevice(undefined, videoEl, (result) => {
          if (!result) return
          const code = result.getText()
          if (code === lastScanned.current) return
          lastScanned.current = code
          // Debounce 1s to avoid duplicate calls
          if (debounceRef.current) clearTimeout(debounceRef.current)
          debounceRef.current = setTimeout(() => {
            lastScanned.current = ''
            handleLookup(code)
          }, 1000)
        })
        if (!cancelled) {
          scanControlsRef.current = controls
        } else {
          controls.stop()
        }
      } catch {
        // Camera not available — user will use manual input
      }
    }
    void startScanner()
    return () => {
      cancelled = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
      scanControlsRef.current?.stop()
      scanControlsRef.current = null
    }
  }, [handleLookup])

  const prefill = product
    ? {
        item_name: product.item_name,
        brand: product.brand ?? '',
        quantity: product.default_quantity,
        total_volume: product.default_quantity,
        unit: product.unit,
        category: product.category ?? '',
      }
    : undefined

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Barcode Scanner" />

      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 lg:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
          {/* Left: Scanner + manual input */}
          <div className="flex flex-col gap-4">
            {/* Camera area */}
            <div
              ref={scannerContainerRef}
              className="relative aspect-video bg-muted rounded-xl overflow-hidden border border-border flex items-center justify-center"
            >
              <video id="barcode-video" className="absolute inset-0 w-full h-full object-cover" />
              <div className="relative z-10 flex flex-col items-center gap-2 text-muted-foreground">
                <ScanBarcode className="w-8 h-8" />
                <p className="text-xs">Point camera at barcode</p>
              </div>
              {/* Scanning indicator */}
              <motion.div
                className="absolute inset-x-8 h-0.5 bg-foreground/40 z-20"
                animate={{ top: ['20%', '80%', '20%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
              />
            </div>

            {/* Manual input */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">Or enter barcode manually</Label>
              <div className="flex gap-2">
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="e.g. 5000159484695"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLookup(manualCode)
                  }}
                  className="flex-1"
                />
                <Button onClick={() => handleLookup(manualCode)} disabled={lookupMutation.isPending}>
                  <Search className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Recent scans */}
            {recent.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-medium">Recent scans</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {recent.map((code) => (
                    <button
                      key={code}
                      onClick={() => handleLookup(code)}
                      className="text-xs bg-muted text-foreground px-2 py-1 rounded-md hover:bg-muted/80 transition-colors font-mono"
                    >
                      {code}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Product result */}
          <div>
            <AnimatePresence mode="wait">
              {lookupMutation.isPending && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-3"
                >
                  <Skeleton className="h-48 rounded-xl" />
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-1/3" />
                </motion.div>
              )}

              {!lookupMutation.isPending && product === false && (
                <motion.div
                  key="not-found"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center py-12 text-center"
                >
                  <Package className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-sm font-medium">Product not found</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    Barcode: <span className="font-mono">{currentCode}</span>
                  </p>
                  <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    Add manually
                  </Button>
                </motion.div>
              )}

              {!lookupMutation.isPending && product && typeof product === 'object' && (
                <motion.div
                  key="found"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <Card>
                    <CardContent className="p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Product Found</p>
                          <h2 className="text-base font-semibold text-foreground">
                            {product.item_name}
                          </h2>
                          {product.brand && (
                            <p className="text-sm text-muted-foreground">{product.brand}</p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          <ExternalLink className="w-2.5 h-2.5 mr-1" />
                          OpenFoodFacts
                        </Badge>
                      </div>

                      {/* Product image */}
                      {product.image_url && (
                        <div className="w-full h-36 bg-muted rounded-lg overflow-hidden mb-4">
                          <img
                            src={product.image_url}
                            alt={product.item_name}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      )}

                      {/* Details grid */}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
                        {[
                          { label: 'Category', value: product.category ?? '—' },
                          { label: 'Unit', value: product.unit },
                          { label: 'Default qty', value: `${product.default_quantity} ${product.unit}` },
                          { label: 'Barcode', value: currentCode },
                        ].map(({ label, value }) => (
                          <div key={label}>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
                            <p className="text-sm text-foreground font-medium">{value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 gap-1.5" onClick={() => setAddOpen(true)}>
                          <Plus className="w-3.5 h-3.5" />
                          Add to Inventory
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5">
                          <Bot className="w-3.5 h-3.5" />
                          Add via Agent
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {!lookupMutation.isPending && product === null && !currentCode && (
                <motion.div
                  key="idle"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-16 text-center"
                >
                  <ScanBarcode className="w-10 h-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Scan or enter a barcode to look up product info</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <AddItemSheet open={addOpen} onClose={() => setAddOpen(false)} prefill={prefill} />
    </div>
  )
}
