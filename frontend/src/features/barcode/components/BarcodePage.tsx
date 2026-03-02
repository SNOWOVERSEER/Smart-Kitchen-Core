import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ScanBarcode, Search, Package, ExternalLink, Plus, Bot, Clock, Camera, CameraOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { TopBar } from '@/shared/components/TopBar'
import { DesktopPageHeader } from '@/shared/components/DesktopPageHeader'
import { AddItemSheet } from '@/features/inventory/components/AddItemSheet'
import { getCategoryColor } from '@/features/inventory/components/ItemGroupCard'
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
  const { t } = useTranslation()
  const [manualCode, setManualCode] = useState('')
  const [product, setProduct] = useState<BarcodeProduct | null | false>(null) // null=idle, false=not found
  const [addOpen, setAddOpen] = useState(false)
  const [recent, setRecent] = useState<string[]>(getRecent)
  const [currentCode, setCurrentCode] = useState('')
  const [cameraOn, setCameraOn] = useState(true)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [scanFlash, setScanFlash] = useState(false)
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
      toast.error(t('barcode.lookupFailed'))
      setProduct(false)
    },
  })

  const handleLookup = useCallback(
    (code: string) => {
      if (!code.trim()) return
      setProduct(null)
      lookupMutation.mutate(code.trim())
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lookupMutation.mutate]
  )

  // Stable ref so the scanner callback always calls the latest handleLookup
  // without being listed as an effect dependency (avoids restarting camera on every render)
  const handleLookupRef = useRef(handleLookup)
  handleLookupRef.current = handleLookup

  // Camera scanner — only restarts when cameraOn changes
  useEffect(() => {
    if (!cameraOn) return
    setCameraError(null)
    let cancelled = false
    async function startScanner() {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        // Import hints from @zxing/library (peer dep of @zxing/browser, always present)
        // TRY_HARDER=3 enables multi-angle, multi-size, rotated barcode detection
        // POSSIBLE_FORMATS=2 limits to grocery-relevant formats for speed
        const { DecodeHintType, BarcodeFormat } = await import('@zxing/library')
        const hints = new Map<number, unknown>([
          [DecodeHintType.TRY_HARDER, true],
          [DecodeHintType.POSSIBLE_FORMATS, [
            BarcodeFormat.EAN_13,   // most common grocery barcode
            BarcodeFormat.EAN_8,
            BarcodeFormat.UPC_A,
            BarcodeFormat.UPC_E,
            BarcodeFormat.CODE_128,
            BarcodeFormat.CODE_39,
            BarcodeFormat.QR_CODE,
            BarcodeFormat.DATA_MATRIX,
          ]],
        ])
        const reader = new BrowserMultiFormatReader(hints)
        const videoEl = document.getElementById('barcode-video') as HTMLVideoElement | null
        if (!videoEl || cancelled) return

        // High resolution improves detection at distance; environment = rear camera on mobile
        const controls = await reader.decodeFromConstraints(
          { video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          }},
          videoEl,
          (result) => {
            if (!result) return
            const code = result.getText()
            if (code === lastScanned.current) return
            lastScanned.current = code

            // Immediate feedback: full-area flash + haptic on mobile
            setScanFlash(true)
            setTimeout(() => setScanFlash(false), 900)
            if (navigator.vibrate) navigator.vibrate(80)

            // Debounce the API lookup to avoid duplicate calls
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
              lastScanned.current = ''
              handleLookupRef.current(code)
            }, 800)
          }
        )
        if (!cancelled) {
          scanControlsRef.current = controls
        } else {
          controls.stop()
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : 'Camera unavailable'
          setCameraError(msg)
          setCameraOn(false)
        }
      }
    }
    void startScanner()
    return () => {
      cancelled = true
      if (debounceRef.current) clearTimeout(debounceRef.current)
      scanControlsRef.current?.stop()
      scanControlsRef.current = null
    }
  }, [cameraOn])

  const toggleCamera = () => {
    if (cameraOn) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      scanControlsRef.current?.stop()
      scanControlsRef.current = null
    } else {
      setCameraError(null)
    }
    setCameraOn((prev) => !prev)
  }

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
      <TopBar
        actionsOnly
        className="hidden lg:flex fixed top-4 right-4 z-30 rounded-xl border border-stone-200/80 bg-white/90 backdrop-blur-sm px-2 py-1.5 shadow-sm"
      />

      <div className="lg:hidden">
        <TopBar title={t('barcode.title')} mobileIcon={ScanBarcode} />
      </div>

      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 lg:py-6">
        <DesktopPageHeader
          icon={ScanBarcode}
          title={t('barcode.title')}
          className="mb-6"
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
          {/* Left: Scanner + manual input */}
          <div className="flex flex-col gap-4">
            {/* Camera area */}
            <div
              ref={scannerContainerRef}
              className="relative aspect-video bg-muted rounded-xl overflow-hidden border border-border flex items-center justify-center"
            >
              {/* Mirrored video feed — scaleX(-1) so moving left = image moves left */}
              <video
                id="barcode-video"
                className="absolute inset-0 w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)', display: cameraOn ? 'block' : 'none' }}
              />

              {/* Camera-off placeholder */}
              {!cameraOn && (
                <div className="relative z-10 flex flex-col items-center gap-3 text-center px-4">
                  <CameraOff className="w-8 h-8 text-muted-foreground" />
                  {cameraError ? (
                    <>
                      <p className="text-xs text-destructive font-medium">{t('barcode.cameraError')}</p>
                      <p className="text-[11px] text-muted-foreground max-w-[200px]">{cameraError}</p>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t('barcode.cameraOff')}</p>
                  )}
                  <button
                    onClick={toggleCamera}
                    className="flex items-center gap-1.5 text-xs font-medium text-foreground bg-card border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    {cameraError ? t('barcode.retry') : t('barcode.startCamera')}
                  </button>
                </div>
              )}

              {/* Idle guide — only when camera on and not flashing */}
              {cameraOn && !scanFlash && (
                <div className="relative z-10 flex flex-col items-center gap-2 text-muted-foreground pointer-events-none">
                  <ScanBarcode className="w-8 h-8" />
                  <p className="text-xs">{t('barcode.pointCamera')}</p>
                </div>
              )}

              {/* Corner brackets — always visible when camera on */}
              {cameraOn && [
                { top: '8px', left: '8px',  borderTop: 2, borderLeft: 2  },
                { top: '8px', right: '8px', borderTop: 2, borderRight: 2 },
                { bottom: '8px', left: '8px',  borderBottom: 2, borderLeft: 2  },
                { bottom: '8px', right: '8px', borderBottom: 2, borderRight: 2 },
              ].map((pos, i) => (
                <div
                  key={i}
                  className="absolute w-5 h-5 z-20 pointer-events-none"
                  style={{ ...pos, borderColor: '#C97B5C', borderStyle: 'solid' }}
                />
              ))}

              {/* Scan success flash — full-area green overlay with checkmark */}
              <AnimatePresence>
                {scanFlash && (
                  <motion.div
                    key="flash"
                    className="absolute inset-0 z-25 rounded-xl pointer-events-none flex flex-col items-center justify-center gap-2"
                    style={{ backgroundColor: 'rgba(34,197,94,0.18)' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                  >
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: 'rgba(34,197,94,0.9)' }}
                    >
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-white drop-shadow">{t('barcode.scanned')}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Camera toggle button — always visible in top-right */}
              <button
                onClick={toggleCamera}
                title={cameraOn ? t('barcode.turnOffCamera') : t('barcode.turnOnCamera')}
                className="absolute top-2 right-2 z-30 w-8 h-8 flex items-center justify-center rounded-lg bg-black/40 text-white hover:bg-black/60 transition-colors cursor-pointer"
              >
                {cameraOn ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
              </button>
            </div>

            {/* Manual input */}
            <div className="flex flex-col gap-2">
              <Label className="text-xs text-muted-foreground">{t('barcode.manualLabel')}</Label>
              <div className="flex gap-2">
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder={t('barcode.manualPlaceholder')}
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
                  <span className="text-xs text-muted-foreground font-medium">{t('barcode.recentScans')}</span>
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
                  <p className="text-sm font-medium">{t('barcode.productNotFound')}</p>
                  <p className="text-xs text-muted-foreground mt-1 mb-4">
                    {t('barcode.barcodeColon')} <span className="font-mono">{currentCode}</span>
                  </p>
                  <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    {t('barcode.addManually')}
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
                  <Card style={{ borderLeft: `4px solid ${getCategoryColor(product.category)}` }}>
                    <CardContent className="p-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2 mb-4">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{t('barcode.productFound')}</p>
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
                          { label: t('barcode.categoryLabel'), value: product.category ?? '—' },
                          { label: t('barcode.unitLabel'),     value: product.unit },
                          { label: t('barcode.defaultQtyLabel'), value: `${product.default_quantity} ${product.unit}` },
                          { label: t('barcode.barcodeLabel'),  value: currentCode },
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
                          {t('barcode.addToInventory')}
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 gap-1.5">
                          <Bot className="w-3.5 h-3.5" />
                          {t('barcode.addViaAgent')}
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
                  <p className="text-sm text-muted-foreground">{t('barcode.idle')}</p>
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
