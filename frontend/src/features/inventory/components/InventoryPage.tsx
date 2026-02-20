import { useState, useMemo } from 'react'
import { Plus, Package } from 'lucide-react'
import { motion } from 'framer-motion'
import Masonry from 'react-masonry-css'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { TopBar } from '@/shared/components/TopBar'
import { ItemGroupCard } from './ItemGroupCard'
import { AddItemSheet } from './AddItemSheet'
import { useInventory } from '../hooks/useInventory'
import { expiryStatus } from '@/shared/lib/utils'

// Active style tokens
const CATEGORY_ACTIVE = { bg: '#C97B5C', text: '#FFFFFF', border: '#C97B5C' }
const LOCATION_ACTIVE  = { bg: '#4D7C8A', text: '#FFFFFF', border: '#4D7C8A' }
const INACTIVE_STYLE   = { backgroundColor: 'transparent', borderColor: '#E8E2D9', color: '#8C7B6E' } as const

// Keys are max-width breakpoints; `default` applies above the largest key.
// Mirrors Tailwind md (768px) / xl (1280px).
const MASONRY_COLS = {
  default: 3, // ≥ 1280px
  1279:    2, // 768px – 1279px
  767:     1, // < 768px
}

export function InventoryPage() {
  const { t } = useTranslation()
  const { data: groups, isLoading } = useInventory()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [location, setLocation] = useState('All')
  const [addOpen, setAddOpen] = useState(false)

  // Derive unique categories and locations from live data
  const uniqueCategories = useMemo(() => {
    if (!groups) return []
    const cats = new Set<string>()
    groups.forEach((g) => g.batches.forEach((b) => { if (b.category) cats.add(b.category) }))
    return Array.from(cats).sort()
  }, [groups])

  const uniqueLocations = useMemo(() => {
    if (!groups) return []
    const locs = new Set<string>()
    groups.forEach((g) => g.batches.forEach((b) => { if (b.location) locs.add(b.location) }))
    return Array.from(locs).sort()
  }, [groups])

  const filtered = groups?.filter((g) => {
    const matchSearch = g.item_name.toLowerCase().includes(search.toLowerCase())
    const matchCat =
      category === 'All' ||
      g.batches.some((b) => b.category?.toLowerCase() === category.toLowerCase())
    const matchLocation =
      location === 'All' ||
      g.batches.some((b) => b.location?.toLowerCase() === location.toLowerCase())
    return matchSearch && matchCat && matchLocation
  }) ?? []

  // Stat calculations
  const totalItems = groups?.length ?? 0
  const expiringSoon = groups?.filter((g) =>
    g.batches.some((b) => {
      const s = expiryStatus(b.expiry_date)
      return s === 'critical' || s === 'warning'
    })
  ).length ?? 0
  const openItems = groups?.filter((g) => g.batches.some((b) => b.is_open)).length ?? 0

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title={t('inventory.title')}
        searchValue={search}
        onSearchChange={setSearch}
      />

      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 lg:py-6">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            {
              labelKey: 'inventory.expiringSoon',
              value: expiringSoon,
              borderColor: '#D97706',
              bg: '#FEF3C7',
              textColor: '#D97706',
            },
            {
              labelKey: 'inventory.totalItems',
              value: totalItems,
              borderColor: '#C97B5C',
              bg: '#F5EAE4',
              textColor: '#C97B5C',
            },
            {
              labelKey: 'inventory.openPackages',
              value: openItems,
              borderColor: '#6B7B3C',
              bg: '#EEF2E2',
              textColor: '#6B7B3C',
            },
          ].map(({ labelKey, value, borderColor, bg, textColor }, i) => (
            <motion.div
              key={labelKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-xl p-4 lg:p-5 overflow-hidden relative"
              style={{ borderLeft: `4px solid ${borderColor}` }}
            >
              <div
                className="absolute top-0 right-0 w-16 h-16 rounded-bl-full opacity-40"
                style={{ backgroundColor: bg }}
              />
              <p
                className="text-3xl lg:text-4xl leading-none"
                style={{ fontFamily: '"DM Serif Display", Georgia, serif', color: textColor }}
              >
                {isLoading ? '—' : value}
              </p>
              <p className="text-[11px] text-muted-foreground mt-2">{t(labelKey)}</p>
            </motion.div>
          ))}
        </div>

        {/* Filters + Add button */}
        <div className="flex flex-col gap-2 mb-4">
          {/* Category filter row */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0 w-16">
              {t('inventory.category')}
            </span>
            <div className="flex-1 overflow-x-auto">
              <div className="flex gap-1.5 pb-0.5">
                {['All', ...uniqueCategories].map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategory(c)}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer capitalize"
                    style={
                      category === c
                        ? { backgroundColor: CATEGORY_ACTIVE.bg, borderColor: CATEGORY_ACTIVE.border, color: CATEGORY_ACTIVE.text }
                        : INACTIVE_STYLE
                    }
                  >
                    {c === 'All' ? t('history.all') : c}
                  </button>
                ))}
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => setAddOpen(true)}
              className="gap-1.5 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              {t('inventory.addItem')}
            </Button>
          </div>

          {/* Location filter row — only shown when there are locations */}
          {uniqueLocations.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide shrink-0 w-16">
                {t('inventory.location')}
              </span>
              <div className="flex-1 overflow-x-auto">
                <div className="flex gap-1.5 pb-0.5">
                  {['All', ...uniqueLocations].map((l) => (
                    <button
                      key={l}
                      onClick={() => setLocation(l)}
                      className="shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors cursor-pointer"
                      style={
                        location === l
                          ? { backgroundColor: LOCATION_ACTIVE.bg, borderColor: LOCATION_ACTIVE.border, color: LOCATION_ACTIVE.text }
                          : INACTIVE_STYLE
                      }
                    >
                      {l === 'All' ? t('history.all') : l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Masonry grid via react-masonry-css.
            Distributes items round-robin into independent column divs —
            expanding a card only pushes cards below it in that column. */}
        {isLoading ? (
          <Masonry
            breakpointCols={MASONRY_COLS}
            className="flex gap-3"
            columnClassName="flex flex-col gap-3 min-w-0"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </Masonry>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium text-foreground">{t('inventory.noItemsFound')}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? t('inventory.tryDifferentSearch') : t('inventory.addItemsToStart')}
            </p>
          </div>
        ) : (
          <Masonry
            breakpointCols={MASONRY_COLS}
            className="flex gap-3"
            columnClassName="flex flex-col gap-3 min-w-0"
          >
            {filtered.map((group, i) => (
              <ItemGroupCard key={group.item_name} group={group} delay={i * 0.04} />
            ))}
          </Masonry>
        )}
      </div>

      <AddItemSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </div>
  )
}
