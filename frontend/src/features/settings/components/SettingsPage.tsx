import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  User, Bot, Bell, CheckCircle, Trash2, Plus, Eye, EyeOff, Lock,
} from 'lucide-react'
import { useAuthStore } from '@/shared/stores/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

const TABS: { id: Tab; label: string; icon: typeof User }[] = [
  { id: 'profile',       label: 'Profile',           icon: User },
  { id: 'ai',            label: 'AI Configuration',  icon: Bot  },
  { id: 'notifications', label: 'Notifications',     icon: Bell },
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

// ─── Section heading ────────────────────────────────────────────────────
function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
    </div>
  )
}

// ─── Field label ─────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-widest">
      {children}
    </Label>
  )
}

// ─── Profile tab ─────────────────────────────────────────────────────────
function ProfileTab() {
  const { data: profile, isLoading } = useQuery({ queryKey: ['profile'], queryFn: getProfile })
  const storeEmail = useAuthStore((s) => s.email)
  const [name, setName] = useState('')
  const [lang, setLang] = useState('')

  const mutation = useMutation({
    mutationFn: () => updateProfile({ display_name: name, preferred_language: lang }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['profile'] })
      toast.success('Profile updated')
    },
    onError: () => toast.error('Failed to update profile'),
  })

  const displayEmail = profile?.email ?? storeEmail ?? ''
  const displayName  = profile?.display_name ?? ''

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6 max-w-md">
        <div className="flex items-center gap-4">
          <Skeleton className="w-14 h-14 rounded-full shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
          <Skeleton className="h-11" />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8 max-w-md">
      <SectionHeading title="Profile" description="Manage your personal information and preferences." />

      {/* Avatar row */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/40 border border-border">
        <div className="w-12 h-12 rounded-full bg-foreground flex items-center justify-center shrink-0 select-none">
          <span className="text-sm font-semibold tracking-wide text-background">
            {getInitials(displayName, displayEmail)}
          </span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {displayName || 'No name set'}
          </p>
          <p className="text-xs text-muted-foreground truncate">{displayEmail}</p>
        </div>
      </div>

      {/* Form fields */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <FieldLabel>Display Name</FieldLabel>
          <Input
            value={name || displayName}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            className="h-10"
          />
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>Email</FieldLabel>
          <Input
            value={displayEmail}
            disabled
            className="h-10 bg-muted/50 text-muted-foreground cursor-not-allowed"
          />
          <p className="text-[11px] text-muted-foreground">Email cannot be changed here.</p>
        </div>

        <div className="flex flex-col gap-2">
          <FieldLabel>Language</FieldLabel>
          <Select
            value={lang || profile?.preferred_language || 'en'}
            onValueChange={setLang}
            key={profile?.preferred_language}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="zh">Chinese (中文)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="w-fit h-10 px-6"
      >
        {mutation.isPending ? 'Saving...' : 'Save changes'}
      </Button>
    </div>
  )
}

// ─── AI config tab ────────────────────────────────────────────────────────
function AIConfigTab() {
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
      toast.success('AI provider saved')
      setShowForm(false)
      setFormKey('')
    },
    onError: () => toast.error('Failed to save provider'),
  })

  const deleteMutation = useMutation({
    mutationFn: (provider: string) => deleteAIConfig(provider),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ai-configs'] })
      toast.success('Provider removed')
    },
    onError: () => toast.error('Failed to remove provider'),
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
      toast.error('Failed to activate provider')
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['ai-configs'] }),
  })

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 max-w-md">
        <Skeleton className="h-6 w-32 mb-2" />
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-20 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 max-w-md">
      <SectionHeading
        title="AI Configuration"
        description="Connect your AI provider to power the agent."
      />

      {/* Existing provider cards */}
      {configs?.map((config) => {
        const meta = PROVIDER_META[config.provider] ?? { name: config.provider, dotColor: 'bg-foreground' }
        return (
          <div
            key={config.id}
            className={cn(
              'rounded-xl border p-4 transition-colors',
              config.is_active
                ? 'border-foreground/20 bg-foreground/[0.025]'
                : 'border-border bg-card'
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                {/* Provider dot */}
                <div className="mt-0.5 flex flex-col items-center gap-1 shrink-0">
                  <span className={cn('w-2.5 h-2.5 rounded-full', meta.dotColor)} />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{meta.name}</span>
                    {config.is_active && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 leading-none">
                        <CheckCircle className="w-2.5 h-2.5" />
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{config.model_id}</p>
                  <p className="text-[11px] text-muted-foreground/60 font-mono mt-0.5 truncate">
                    {config.api_key_preview}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {!config.is_active && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => activateMutation.mutate(config.provider)}
                    disabled={activateMutation.isPending}
                  >
                    Set active
                  </Button>
                )}
                <button
                  onClick={() => deleteMutation.mutate(config.provider)}
                  disabled={deleteMutation.isPending}
                  className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Remove provider"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )
      })}

      {/* Add provider — form or button */}
      <AnimatePresence mode="wait">
        {showForm ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className="text-sm font-semibold text-foreground mb-4">Add provider</p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <FieldLabel>Provider</FieldLabel>
                <Select
                  value={formProvider}
                  onValueChange={(v) => {
                    setFormProvider(v)
                    setFormModel(MODELS[v]?.[0] ?? '')
                  }}
                >
                  <SelectTrigger className="h-10">
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

              <div className="flex flex-col gap-2">
                <FieldLabel>API Key</FieldLabel>
                <div className="relative">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={formKey}
                    onChange={(e) => setFormKey(e.target.value)}
                    placeholder="sk-..."
                    className="h-10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <Lock className="w-3 h-3 mt-0.5 shrink-0" />
                  Your key is encrypted and stored securely in Supabase Vault
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <FieldLabel>Model</FieldLabel>
                <Select value={formModel} onValueChange={setFormModel}>
                  <SelectTrigger className="h-10">
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
                <Button variant="outline" className="flex-1 h-10" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 h-10"
                  onClick={() =>
                    addMutation.mutate({ provider: formProvider, api_key: formKey, model_id: formModel })
                  }
                  disabled={!formKey || addMutation.isPending}
                >
                  {addMutation.isPending ? 'Saving...' : 'Save'}
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
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border border-dashed border-border hover:border-foreground/30 rounded-xl px-4 py-3.5 transition-colors w-full"
          >
            <Plus className="w-4 h-4" />
            Add provider
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Notifications placeholder ────────────────────────────────────────────
function NotificationsTab() {
  return (
    <div className="max-w-md">
      <SectionHeading title="Notifications" description="Control how and when you receive alerts." />
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Notification settings coming soon.
      </div>
    </div>
  )
}

// ─── Settings page ────────────────────────────────────────────────────────
export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Settings" />

      {/*
        Outer wrapper: flex-col constrains height so inner content can scroll.
        max-w-5xl centers on large screens; h-full fills remaining viewport height.
      */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col lg:flex-row h-full max-w-5xl mx-auto">

          {/*
            Navigation.
            Mobile/tablet: horizontal scrollable strip with underline indicator.
            Desktop (lg+): vertical sidebar with background indicator.
            Single <nav> — CSS changes the direction.
          */}
          <nav className={cn(
            // shared
            'flex gap-0 shrink-0',
            // mobile/tablet: horizontal row with bottom border divider
            'flex-row overflow-x-auto border-b border-border',
            // desktop: vertical column with right border divider
            'lg:flex-col lg:w-52 lg:border-b-0 lg:border-r lg:py-6 lg:px-3 lg:gap-0.5 lg:overflow-x-visible',
          )}>
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={cn(
                  // shared
                  'flex items-center gap-2.5 text-sm transition-colors whitespace-nowrap shrink-0 text-left',
                  // mobile/tablet: tab-style with underline
                  'px-3 py-3 border-b-2',
                  // desktop: pill with background
                  'lg:px-3 lg:py-2 lg:rounded-lg lg:w-full lg:border-b-0',
                  activeTab === id
                    ? 'border-foreground text-foreground font-medium lg:bg-muted lg:border-transparent'
                    : 'border-transparent text-muted-foreground hover:text-foreground lg:hover:bg-muted/50',
                )}
              >
                <Icon className="hidden lg:block w-4 h-4 shrink-0" />
                {label}
              </button>
            ))}
          </nav>

          {/* Main content — scrollable independently */}
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
