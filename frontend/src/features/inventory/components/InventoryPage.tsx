import { useState } from 'react'
import { Plus, AlertTriangle, Package, PackageOpen } from 'lucide-react'
import { motion } from 'framer-motion'
import Masonry from 'react-masonry-css'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TopBar } from '@/shared/components/TopBar'
import { ItemGroupCard } from './ItemGroupCard'
import { AddItemSheet } from './AddItemSheet'
import { useInventory } from '../hooks/useInventory'
import { expiryStatus } from '@/shared/lib/utils'

const CATEGORIES = ['All', 'Dairy', 'Meat', 'Vegetable', 'Fruit', 'Pantry', 'Beverage', 'Other']

// Keys are max-width breakpoints; `default` applies above the largest key.
// Mirrors Tailwind md (768px) / xl (1280px).
const MASONRY_COLS = {
  default: 3, // ≥ 1280px
  1279:    2, // 768px – 1279px
  767:     1, // < 768px
}

export function InventoryPage() {
  const { data: groups, isLoading } = useInventory()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [addOpen, setAddOpen] = useState(false)

  const filtered = groups?.filter((g) => {
    const matchSearch = g.item_name.toLowerCase().includes(search.toLowerCase())
    const matchCat =
      category === 'All' ||
      g.batches.some((b) => b.category?.toLowerCase() === category.toLowerCase())
    return matchSearch && matchCat
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
        title="Inventory"
        searchValue={search}
        onSearchChange={setSearch}
      />

      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 lg:py-6">
        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            {
              label: 'Expiring Soon',
              value: expiringSoon,
              icon: AlertTriangle,
              color: 'text-amber-500',
              bg: 'bg-amber-50',
            },
            {
              label: 'Total Items',
              value: totalItems,
              icon: Package,
              color: 'text-foreground',
              bg: 'bg-muted',
            },
            {
              label: 'Open Packages',
              value: openItems,
              icon: PackageOpen,
              color: 'text-blue-500',
              bg: 'bg-blue-50',
            },
          ].map(({ label, value, icon: Icon, color, bg }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-xl p-3 lg:p-4"
            >
              <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center mb-2`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
              <p className="text-xl font-bold text-foreground">{isLoading ? '—' : value}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
            </motion.div>
          ))}
        </div>

        {/* Category filter + Add button */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 overflow-x-auto">
            <Tabs value={category} onValueChange={setCategory}>
              <TabsList className="h-8 gap-1">
                {CATEGORIES.map((c) => (
                  <TabsTrigger key={c} value={c} className="text-xs px-2.5 h-6">
                    {c}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <Button
            size="sm"
            onClick={() => setAddOpen(true)}
            className="gap-1.5 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add item
          </Button>
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
            <p className="text-sm font-medium text-foreground">No items found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {search ? 'Try a different search term' : 'Add items to get started'}
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
