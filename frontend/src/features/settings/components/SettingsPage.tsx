import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Bot, Bell, CheckCircle, Trash2, Plus, Eye, EyeOff, Lock,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/shared/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { TopBar } from '@/shared/components/TopBar'
import { getAIConfigs, addAIConfig, deleteAIConfig, activateProvider } from '../api'
import { getProfile, updateProfile } from '@/features/auth/api'
import { queryClient } from '@/shared/lib/queryClient'
import type { AddAIConfigRequest } from '@/shared/lib/api.types'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

type Tab = 'profile' | 'ai' | 'notifications'

const TABS: { id: Tab; icon: typeof User }[] = [
  { id: 'profile',       icon: User },
  { id: 'ai',            icon: Bot  },
  { id: 'notifications', icon: Bell },
]

const PROVIDERS = ['openai', 'anthropic']
const MODELS: Record<string, string[]> = {
  openai:    ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  anthropic: ['claude-sonnet-4-6', 'claude-opus-4-6', 'claude-haiku-4-5-20251001'],
}
const PROVIDER_META: Record<string, { name: string; dotColor: string }> = {
  openai:    { name: 'OpenAI',    dotColor: 'bg-emerald-500' },
  anthropic: { name: 'Anthropic', dotColor: 'bg-amber-500'  },
}

function getInitials(name: string | null | undefined, email: string | null | undefined) {
  if (name?.trim()) {
    return name.trim().split(/\s+/).map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  }
  if (email) return email[0].toUpperCase()
  return 'U'
}

// ─── Setting row ─────────────────────────────────────────────────────────
function SettingRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-6 py-4">
      <div className="shrink-0 sm:max-w-[200px]">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="sm:w-64">{children}</div>
    </div>
  )
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

// ─── Profile tab ──────────────────────────────────────────────────────────
function ProfileTab() {
  const { t } = useTranslation()
  const { data: profile, isLoading } = useQuery({ queryKey: ['profile'], queryFn: getProfile })
  const storeEmail = useAuthStore((s) => s.email)
  const [name, setName] = useState('')
  const [lang, setLang] = useState('en')

  useEffect(() => {
    if (profile) {
      setName(profile.display_name ?? '')
      setLang(profile.preferred_language ?? 'en')
    }
  }, [profile])

  const mutation = useMutation({
    mutationFn: () => updateProfile({ display_name: name, preferred_language: lang }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast.success(t('settings.profile.success'))
    },
    onError: () => toast.error(t('settings.profile.error')),
  })

  const displayEmail = profile?.email ?? storeEmail ?? ''
  const displayName  = profile?.display_name ?? ''

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 pb-6 border-b border-border">
          <Skeleton className="w-10 h-10 rounded-full shrink-0" />
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    )
  }

  return (
    <div>
      <SectionHeading
        title={t('settings.profile.heading')}
        description={t('settings.profile.description')}
      />

      {/* Avatar header */}
      <div className="flex items-center gap-3 pb-5 mb-1 border-b border-border">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 select-none"
          style={{ backgroundColor: '#C97B5C' }}
        >
          <span className="text-sm font-semibold tracking-wide text-white">
            {getInitials(displayName, displayEmail)}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {displayName || t('settings.profile.noName')}
          </p>
          <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
        </div>
      </div>

      {/* Setting rows */}
      <div className="divide-y divide-border">
        <SettingRow label={t('settings.profile.displayName')}>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('settings.profile.displayNamePlaceholder')}
            className="h-9 w-full"
          />
        </SettingRow>

        <SettingRow label={t('settings.profile.email')} description={t('settings.profile.emailDescription')}>
          <Input
            value={displayEmail}
            disabled
            className="h-9 w-full bg-muted/50 text-muted-foreground cursor-not-allowed"
          />
        </SettingRow>

        <SettingRow label={t('settings.profile.language')}>
          <Select value={lang} onValueChange={setLang}>
            <SelectTrigger className="h-9 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t('settings.profile.langEn')}</SelectItem>
              <SelectItem value="zh">{t('settings.profile.langZh')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingRow>
      </div>

      <div className="mt-6">
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="h-9 px-5"
        >
          {mutation.isPending ? t('settings.profile.saving') : t('settings.profile.saveChanges')}
        </Button>
      </div>
    </div>
  )
}

// ─── AI config tab ────────────────────────────────────────────────────────
function AIConfigTab() {
  const { t } = useTranslation()
  const { data: configs, isLoading } = useQuery({
    queryKey: ['ai-configs'],
    queryFn: getAIConfigs,
  })
  const [showForm, setShowForm] = useState(false)
  const [formProvider, setFormProvider] = useState('openai')
  const [formKey, setFormKey] = useState('')
  const [formModel, setFormModel] = useState('gpt-4o')
  const [showKey, setShowKey] = useState(false)

  const addMutation = useMutation({
    mutationFn: (data: AddAIConfigRequest) => addAIConfig(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ai-configs'] })
      toast.success(t('settings.ai.savedSuccess'))
      setShowForm(false)
      setFormKey('')
    },
    onError: () => toast.error(t('settings.ai.saveFailed')),
  })

  const deleteMutation = useMutation({
    mutationFn: (provider: string) => deleteAIConfig(provider),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ai-configs'] })
      toast.success(t('settings.ai.removedSuccess'))
    },
    onError: () => toast.error(t('settings.ai.removeFailed')),
  })

  const activateMutation = useMutation({
    mutationFn: (provider: string) => activateProvider(provider),
    onMutate: async (provider) => {
      await queryClient.cancelQueries({ queryKey: ['ai-configs'] })
      const prev = queryClient.getQueryData(['ai-configs'])
      queryClient.setQueryData(['ai-configs'], (old: typeof configs) =>
        old?.map((c) => ({ ...c, is_active: c.provider === provider }))
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      queryClient.setQueryData(['ai-configs'], ctx?.prev)
      toast.error(t('settings.ai.activateFailed'))
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['ai-configs'] }),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-5 w-36 mb-3" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    )
  }

  return (
    <div>
      <SectionHeading
        title={t('settings.ai.heading')}
        description={t('settings.ai.description')}
      />

      {/* Provider rows */}
      <div className="divide-y divide-border">
        {configs?.map((config) => {
          const meta = PROVIDER_META[config.provider] ?? { name: config.provider, dotColor: 'bg-foreground' }
          return (
            <div key={config.id} className="flex items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className={cn('w-2 h-2 rounded-full shrink-0', meta.dotColor)} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-foreground">{meta.name}</span>
                    {config.is_active && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 leading-none">
                        <CheckCircle className="w-2.5 h-2.5" />
                        {t('settings.ai.active')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{config.model_id}</p>
                  <p className="text-[11px] text-muted-foreground/60 font-mono truncate">{config.api_key_preview}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!config.is_active && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => activateMutation.mutate(config.provider)}
                    disabled={activateMutation.isPending}
                  >
                    {t('settings.ai.setActive')}
                  </Button>
                )}
                <button
                  onClick={() => deleteMutation.mutate(config.provider)}
                  disabled={deleteMutation.isPending}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                  aria-label={t('settings.ai.removeProvider')}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add provider */}
      <div className="mt-2">
        <AnimatePresence mode="wait">
          {showForm ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="rounded-xl border border-border bg-card p-4 mt-4"
            >
              <p className="text-sm font-medium text-foreground mb-4">{t('settings.ai.addProviderHeading')}</p>
              <div className="flex flex-col gap-4 max-w-sm">
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    {t('settings.ai.provider')}
                  </p>
                  <Select
                    value={formProvider}
                    onValueChange={(v) => {
                      setFormProvider(v)
                      setFormModel(MODELS[v]?.[0] ?? '')
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((p) => (
                        <SelectItem key={p} value={p}>
                          {PROVIDER_META[p]?.name ?? p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    {t('settings.ai.apiKey')}
                  </p>
                  <div className="relative">
                    <Input
                      type={showKey ? 'text' : 'password'}
                      value={formKey}
                      onChange={(e) => setFormKey(e.target.value)}
                      placeholder={t('settings.ai.apiKeyPlaceholder')}
                      className="h-9 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey(!showKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                    {t('settings.ai.apiKeyNote')}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                    {t('settings.ai.model')}
                  </p>
                  <Select value={formModel} onValueChange={setFormModel}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(MODELS[formProvider] ?? []).map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 h-9" onClick={() => setShowForm(false)}>
                    {t('settings.ai.cancel')}
                  </Button>
                  <Button
                    className="flex-1 h-9"
                    onClick={() =>
                      addMutation.mutate({ provider: formProvider, api_key: formKey, model_id: formModel })
                    }
                    disabled={!formKey || addMutation.isPending}
                  >
                    {addMutation.isPending ? t('settings.ai.saving') : t('settings.ai.save')}
                  </Button>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.button
              key="add-btn"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-foreground/30 rounded-xl px-4 py-3 transition-colors w-full mt-3 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              {t('settings.ai.addProvider')}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Notifications placeholder ────────────────────────────────────────────
function NotificationsTab() {
  const { t } = useTranslation()
  return (
    <div>
      <SectionHeading
        title={t('settings.notifications.heading')}
        description={t('settings.notifications.description')}
      />
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {t('settings.notifications.comingSoon')}
      </div>
    </div>
  )
}

// ─── Settings page ────────────────────────────────────────────────────────
export function SettingsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  return (
    <div className="flex flex-col h-full">
      <TopBar title={t('settings.title')} />

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col lg:flex-row h-full max-w-5xl mx-auto">

          {/* Navigation — pill style on all breakpoints */}
          <nav className={cn(
            'flex shrink-0',
            // mobile/tablet: horizontal scrollable row, left-aligned, no border
            'flex-row gap-1 overflow-x-auto px-3 py-2',
            // desktop: vertical column, right border
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
                {t(`settings.tabs.${id}`)}
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
                {activeTab === 'profile'       && <ProfileTab />}
                {activeTab === 'ai'            && <AIConfigTab />}
                {activeTab === 'notifications' && <NotificationsTab />}
              </motion.div>
            </AnimatePresence>
          </main>

        </div>
      </div>
    </div>
  )
}
