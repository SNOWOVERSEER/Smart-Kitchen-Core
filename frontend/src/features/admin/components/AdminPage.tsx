import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, Users, BarChart3, Ticket, Trash2, Pencil, X, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { TopBar } from '@/shared/components/TopBar'
import { DesktopPageHeader } from '@/shared/components/DesktopPageHeader'
import { queryClient } from '@/shared/lib/queryClient'
import {
  getAdminSubscriptions, updateUserCredits,
  getUsageStats, getAdminVouchers, createAdminVoucher, deleteAdminVoucher,
} from '../api'
import type { AdminSubscription, AdminVoucher } from '../api'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

type Tab = 'users' | 'usage' | 'vouchers'

const TABS: { id: Tab; icon: typeof Users }[] = [
  { id: 'users',    icon: Users },
  { id: 'usage',    icon: BarChart3 },
  { id: 'vouchers', icon: Ticket },
]

const TIER_COLORS: Record<string, string> = {
  free:      'bg-zinc-100 text-zinc-700 border-zinc-200',
  supporter: 'bg-amber-50 text-amber-700 border-amber-200',
  byok:      'bg-emerald-50 text-emerald-700 border-emerald-200',
}

// ─── Section heading ──────────────────────────────────────────────────────
function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2
        className="text-lg text-foreground"
        style={{ fontFamily: '"DM Serif Display", Georgia, serif' }}
      >
        {title}
      </h2>
      {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
    </div>
  )
}

// ─── Editable credits row ─────────────────────────────────────────────────
function UserRow({ sub }: { sub: AdminSubscription }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(false)
  const [promptCredits, setPromptCredits] = useState(sub.prompt_credits)
  const [bonusCredits, setBonusCredits] = useState(sub.bonus_credits)

  const mutation = useMutation({
    mutationFn: () => updateUserCredits(sub.user_id, {
      prompt_credits: promptCredits,
      bonus_credits: bonusCredits,
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] })
      toast.success(t('admin.users.creditsSaved'))
      setEditing(false)
    },
    onError: () => toast.error(t('admin.users.creditsFailed')),
  })

  const handleCancel = () => {
    setPromptCredits(sub.prompt_credits)
    setBonusCredits(sub.bonus_credits)
    setEditing(false)
  }

  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
      <td className="py-3 px-3 text-sm text-foreground truncate max-w-[180px]">
        {sub.email ?? '-'}
      </td>
      <td className="py-3 px-3 text-sm text-muted-foreground truncate max-w-[140px]">
        {sub.display_name ?? '-'}
      </td>
      <td className="py-3 px-3">
        <span className={cn(
          'inline-flex items-center text-xs font-semibold rounded-full px-2 py-0.5 border',
          TIER_COLORS[sub.tier] ?? TIER_COLORS.free,
        )}>
          {t(`admin.users.tier_${sub.tier}`, sub.tier)}
        </span>
      </td>
      <td className="py-3 px-3">
        {editing ? (
          <Input
            type="number"
            value={promptCredits}
            onChange={(e) => setPromptCredits(Number(e.target.value))}
            className="h-7 w-20 text-sm"
          />
        ) : (
          <span className="text-sm text-foreground">{sub.prompt_credits}</span>
        )}
      </td>
      <td className="py-3 px-3">
        {editing ? (
          <Input
            type="number"
            value={bonusCredits}
            onChange={(e) => setBonusCredits(Number(e.target.value))}
            className="h-7 w-20 text-sm"
          />
        ) : (
          <span className="text-sm text-foreground">{sub.bonus_credits}</span>
        )}
      </td>
      <td className="py-3 px-3">
        {sub.payment_failed ? (
          <span className="text-xs font-medium text-red-600">{t('admin.users.paymentFailed')}</span>
        ) : (
          <span className="text-xs font-medium text-emerald-600">{t('admin.users.paymentOk')}</span>
        )}
      </td>
      <td className="py-3 px-3">
        {editing ? (
          <div className="flex items-center gap-1">
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer"
              aria-label={t('admin.users.save')}
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={handleCancel}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label={t('admin.users.cancel')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            aria-label={t('admin.users.edit')}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  )
}

// ─── Users tab ────────────────────────────────────────────────────────────
function UsersTab() {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)

  const { data: subs, isLoading, isError, error } = useQuery({
    queryKey: ['admin-subscriptions', page],
    queryFn: () => getAdminSubscriptions(page),
  })

  const is403 = isError && (error as { response?: { status?: number } })?.response?.status === 403

  if (is403) {
    return (
      <div>
        <SectionHeading title={t('admin.users.heading')} />
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-red-600">
          {t('admin.accessDenied')}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-36 mb-3" />
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
    )
  }

  return (
    <div>
      <SectionHeading
        title={t('admin.users.heading')}
        description={t('admin.users.description')}
      />

      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('admin.users.colEmail')}
              </th>
              <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('admin.users.colName')}
              </th>
              <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('admin.users.colTier')}
              </th>
              <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('admin.users.colPromptCredits')}
              </th>
              <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('admin.users.colBonusCredits')}
              </th>
              <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('admin.users.colPayment')}
              </th>
              <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                {t('admin.users.colActions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {subs?.map((sub) => (
              <UserRow key={sub.id} sub={sub} />
            ))}
          </tbody>
        </table>
      </div>

      {subs && subs.length > 0 && (
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            {t('admin.users.prev')}
          </Button>
          <span className="text-xs text-muted-foreground">
            {t('admin.users.page', { page: page + 1 })}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setPage((p) => p + 1)}
            disabled={subs.length < 50}
          >
            {t('admin.users.next')}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── Usage tab ────────────────────────────────────────────────────────────
function UsageTab() {
  const { t } = useTranslation()
  const [days, setDays] = useState('30')

  const { data: stats, isLoading, isError, error } = useQuery({
    queryKey: ['admin-usage', days],
    queryFn: () => getUsageStats(Number(days)),
  })

  const is403 = isError && (error as { response?: { status?: number } })?.response?.status === 403

  if (is403) {
    return (
      <div>
        <SectionHeading title={t('admin.usage.heading')} />
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-red-600">
          {t('admin.accessDenied')}
        </div>
      </div>
    )
  }

  // Collect all unique action keys from the data
  const actionKeys = stats
    ? Array.from(new Set(stats.flatMap((s) => Object.keys(s).filter((k) => k !== 'date'))))
    : []

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-36 mb-3" />
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
    )
  }

  return (
    <div>
      <SectionHeading
        title={t('admin.usage.heading')}
        description={t('admin.usage.description')}
      />

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-muted-foreground">{t('admin.usage.period')}</label>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">{t('admin.usage.last7')}</SelectItem>
            <SelectItem value="30">{t('admin.usage.last30')}</SelectItem>
            <SelectItem value="90">{t('admin.usage.last90')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {stats && stats.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[400px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('admin.usage.colDate')}
                </th>
                {actionKeys.map((key) => (
                  <th
                    key={key}
                    className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider"
                  >
                    {key}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map((row) => (
                <tr key={row.date} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3 text-sm text-foreground">{row.date}</td>
                  {actionKeys.map((key) => (
                    <td key={key} className="py-2.5 px-3 text-sm text-muted-foreground">
                      {row[key] ?? 0}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t('admin.usage.noData')}
        </div>
      )}
    </div>
  )
}

// ─── Vouchers tab ─────────────────────────────────────────────────────────
function VouchersTab() {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const [type, setType] = useState('credits')
  const [value, setValue] = useState('')
  const [maxUses, setMaxUses] = useState('')
  const [expiresAt, setExpiresAt] = useState('')

  const { data: vouchers, isLoading, isError, error } = useQuery({
    queryKey: ['admin-vouchers'],
    queryFn: getAdminVouchers,
  })

  const createMutation = useMutation({
    mutationFn: () => createAdminVoucher({
      code,
      type,
      value: Number(value),
      ...(maxUses ? { max_uses: Number(maxUses) } : {}),
      ...(expiresAt ? { expires_at: expiresAt } : {}),
    }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-vouchers'] })
      toast.success(t('admin.vouchers.created'))
      setCode('')
      setValue('')
      setMaxUses('')
      setExpiresAt('')
    },
    onError: () => toast.error(t('admin.vouchers.createFailed')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAdminVoucher(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-vouchers'] })
      toast.success(t('admin.vouchers.deleted'))
    },
    onError: () => toast.error(t('admin.vouchers.deleteFailed')),
  })

  const handleDelete = (voucher: AdminVoucher) => {
    if (window.confirm(t('admin.vouchers.deleteConfirm', { code: voucher.code }))) {
      deleteMutation.mutate(voucher.id)
    }
  }

  const is403 = isError && (error as { response?: { status?: number } })?.response?.status === 403

  if (is403) {
    return (
      <div>
        <SectionHeading title={t('admin.vouchers.heading')} />
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-red-600">
          {t('admin.accessDenied')}
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-36 mb-3" />
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
    )
  }

  return (
    <div>
      <SectionHeading
        title={t('admin.vouchers.heading')}
        description={t('admin.vouchers.description')}
      />

      {/* Create voucher form */}
      <div className="rounded-xl border border-border bg-card p-4 mb-6">
        <p className="text-sm font-medium text-foreground mb-4">{t('admin.vouchers.createHeading')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-3xl">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {t('admin.vouchers.code')}
            </label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="WELCOME50"
              className="h-9"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {t('admin.vouchers.type')}
            </label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="credits">{t('admin.vouchers.typeCredits')}</SelectItem>
                <SelectItem value="supporter_trial">{t('admin.vouchers.typeSupporterTrial')}</SelectItem>
                <SelectItem value="discount">{t('admin.vouchers.typeDiscount')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {t('admin.vouchers.value')}
            </label>
            <Input
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="50"
              className="h-9"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {t('admin.vouchers.maxUses')}
            </label>
            <Input
              type="number"
              value={maxUses}
              onChange={(e) => setMaxUses(e.target.value)}
              placeholder={t('admin.vouchers.unlimited')}
              className="h-9"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              {t('admin.vouchers.expiresAt')}
            </label>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="flex items-end">
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!code.trim() || !value || createMutation.isPending}
              className="h-9 w-full"
            >
              {createMutation.isPending ? t('admin.vouchers.creating') : t('admin.vouchers.create')}
            </Button>
          </div>
        </div>
      </div>

      {/* Vouchers table */}
      {vouchers && vouchers.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('admin.vouchers.colCode')}
                </th>
                <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('admin.vouchers.colType')}
                </th>
                <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('admin.vouchers.colValue')}
                </th>
                <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('admin.vouchers.colMaxUses')}
                </th>
                <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('admin.vouchers.colUsedCount')}
                </th>
                <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('admin.vouchers.colExpires')}
                </th>
                <th className="py-2.5 px-3 text-left text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {t('admin.vouchers.colActions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map((v) => (
                <tr key={v.id} className="border-b border-border last:border-b-0 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3 text-sm font-mono text-foreground">{v.code}</td>
                  <td className="py-2.5 px-3 text-sm text-muted-foreground">{v.type}</td>
                  <td className="py-2.5 px-3 text-sm text-foreground">{v.value}</td>
                  <td className="py-2.5 px-3 text-sm text-muted-foreground">
                    {v.max_uses ?? t('admin.vouchers.unlimited')}
                  </td>
                  <td className="py-2.5 px-3 text-sm text-muted-foreground">{v.used_count}</td>
                  <td className="py-2.5 px-3 text-sm text-muted-foreground">
                    {v.expires_at ? new Date(v.expires_at).toLocaleDateString() : '-'}
                  </td>
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => handleDelete(v)}
                      disabled={deleteMutation.isPending}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      aria-label={t('admin.vouchers.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t('admin.vouchers.noVouchers')}
        </div>
      )}
    </div>
  )
}

// ─── Admin page ───────────────────────────────────────────────────────────
export function AdminPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('users')

  return (
    <div className="flex flex-col h-full">
      <TopBar
        actionsOnly
        className="hidden lg:flex fixed top-4 right-4 z-30 rounded-xl border border-stone-200/80 bg-white/90 backdrop-blur-sm px-2 py-1.5 shadow-sm"
      />

      <div className="lg:hidden">
        <TopBar title={t('admin.title')} mobileIcon={Shield} />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        <DesktopPageHeader
          icon={Shield}
          title={t('admin.title')}
          className="px-6 pt-6 pb-2"
        />

        <div className="flex-1 min-h-0">
          <div className="flex flex-col lg:flex-row h-full max-w-5xl mx-auto">
            {/* Navigation */}
            <nav className={cn(
              'flex shrink-0',
              'flex-row gap-1 overflow-x-auto px-3 py-2',
              'lg:flex-col lg:gap-0.5 lg:w-52 lg:border-b-0 lg:border-r lg:py-6 lg:px-3 lg:overflow-x-visible',
            )}>
              {TABS.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id)}
                  className={cn(
                    'flex items-center gap-2 text-sm rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer',
                    'lg:w-full',
                    activeTab === id
                      ? 'bg-muted text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  <Icon className="hidden lg:block w-4 h-4 shrink-0" />
                  {t(`admin.tabs.${id}`)}
                </button>
              ))}
            </nav>

            {/* Main content */}
            <main className="flex-1 min-h-0 overflow-y-auto px-4 lg:px-8 py-5 lg:py-8">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.15 }}
                >
                  {activeTab === 'users'    && <UsersTab />}
                  {activeTab === 'usage'    && <UsageTab />}
                  {activeTab === 'vouchers' && <VouchersTab />}
                </motion.div>
              </AnimatePresence>
            </main>
          </div>
        </div>
      </div>
    </div>
  )
}
