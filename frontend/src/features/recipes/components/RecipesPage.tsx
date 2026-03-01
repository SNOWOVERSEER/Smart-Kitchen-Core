import { useRef, useState } from 'react'
import { Heart, ChefHat, SlidersHorizontal, Sparkles, ChevronRight } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useGenerateRecipes, useSavedRecipes } from '@/features/recipes/hooks/useRecipes'
import { RecipeFilterBar } from './RecipeFilterBar'
import { RecipeCardDeck } from './RecipeCardDeck'
import { HeartCollectionPanel } from './HeartCollectionPanel'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { TopBar } from '@/shared/components/TopBar'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import type { RecipeCard } from '@/shared/lib/api.types'

export function RecipesPage() {
  const { t } = useTranslation()
  const heartRef = useRef<HTMLButtonElement>(null)
  const [heartPulse, setHeartPulse] = useState(false)
  const [heartPanelOpen, setHeartPanelOpen] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [deckViewMode, setDeckViewMode] = useState<'stack' | 'fan' | 'grid'>('stack')

  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [useExpiring, setUseExpiring] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [recipes, setRecipes] = useState<RecipeCard[]>([])

  const { data: savedRecipes } = useSavedRecipes()
  const savedCount = savedRecipes?.length ?? 0
  const generateMutation = useGenerateRecipes()
  const recipeDeckKey = recipes.map(recipe => recipe.title).join('|') || 'empty'
  const compactPromptPreview = prompt.trim() || t('recipes.customPromptPlaceholder')

  function handleToggleCategory(cat: string) {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    )
  }

  function handleGenerate() {
    generateMutation.mutate(
      { categories: selectedCategories, use_expiring: useExpiring, prompt: prompt || undefined },
      {
        onSuccess: data => setRecipes(data.recipes),
        onError: () => toast.error(t('recipes.generateFailed')),
      }
    )
  }

  function handleHeartPulse() {
    setHeartPulse(true)
    setTimeout(() => setHeartPulse(false), 400)
  }

  function handleGenerateAndCloseFilters() {
    handleGenerate()
    setFilterSheetOpen(false)
  }

  // Mobile heart — no ref (hidden via CSS when lg, ref would return zero-size DOMRect)
  const mobileHeartButton = (
    <motion.button
      animate={heartPulse ? { scale: [1, 1.35, 1] } : { scale: 1 }}
      transition={{ duration: 0.4 }}
      onClick={() => setHeartPanelOpen(true)}
      className="relative w-11 h-11 [@media(max-width:380px)]:w-10 [@media(max-width:380px)]:h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
      aria-label={t('recipes.savedRecipesPanel')}
    >
      <Heart className="w-[18px] h-[18px] [@media(max-width:380px)]:w-4 [@media(max-width:380px)]:h-4" />
      {savedCount > 0 && (
        <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-primary text-white text-[9px] font-bold border border-background">
          {savedCount > 9 ? '9+' : savedCount}
        </span>
      )}
    </motion.button>
  )

  // Desktop heart — holds the ref used by fly animation (always visible at lg+)
  const desktopHeartButton = (
    <motion.button
      ref={heartRef}
      animate={heartPulse ? { scale: [1, 1.35, 1] } : { scale: 1 }}
      transition={{ duration: 0.4 }}
      onClick={() => setHeartPanelOpen(true)}
      className="relative w-11 h-11 [@media(max-width:380px)]:w-10 [@media(max-width:380px)]:h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
      aria-label={t('recipes.savedRecipesPanel')}
    >
      <Heart className="w-[18px] h-[18px] [@media(max-width:380px)]:w-4 [@media(max-width:380px)]:h-4" />
      {savedCount > 0 && (
        <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center rounded-full bg-primary text-white text-[9px] font-bold border border-background">
          {savedCount > 9 ? '9+' : savedCount}
        </span>
      )}
    </motion.button>
  )

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <TopBar
        actionsOnly
        extraActions={desktopHeartButton}
        className="hidden lg:flex fixed top-4 right-4 z-30 rounded-xl border border-stone-200/80 bg-white/90 backdrop-blur-sm px-2 py-1.5 shadow-sm"
      />

      {/* Mobile header — hidden on lg+ */}
      <header className="flex items-center gap-3 h-[clamp(3.5rem,7.4vh,4.25rem)] [@media(max-width:380px)]:h-12 px-4 [@media(max-width:380px)]:px-3 bg-card border-b border-border shrink-0 lg:hidden">
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="w-7 h-7 [@media(min-height:900px)]:w-8 [@media(min-height:900px)]:h-8 [@media(max-width:380px)]:w-6 [@media(max-width:380px)]:h-6 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: '#C97B5C' }}
          >
            <ChefHat className="w-4 h-4 [@media(min-height:900px)]:w-[18px] [@media(min-height:900px)]:h-[18px] [@media(max-width:380px)]:w-[14px] [@media(max-width:380px)]:h-[14px] text-white" />
          </div>
          <span className="font-display text-base [@media(min-height:900px)]:text-lg [@media(max-width:380px)]:text-[1.05rem] text-foreground">{t('nav.recipes')}</span>
        </div>
        <div className="flex-1" />
        <TopBar
          actionsOnly
          extraActions={mobileHeartButton}
          className="gap-1.5 flex-row-reverse"
        />
      </header>

      {/* Main content — vertical on mobile, two-column on desktop */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* LEFT column: artistic heading + filter bar */}
        <div className="hidden lg:flex lg:w-[360px] xl:w-[400px] lg:shrink-0 flex-col gap-5 lg:overflow-y-auto p-4 lg:p-6">
          {/* Artistic heading — desktop only */}
          <div>
            <h1
              className="font-display leading-[0.88] mb-4"
              style={{ fontSize: '3.25rem' }}
            >
              {t('recipes.headingLine1')}<br />
              <span className="italic font-normal text-primary">{t('recipes.headingLine2')}</span>
            </h1>
            <p className="text-stone-500 text-sm leading-relaxed">
              {t('recipes.subtitle')}
            </p>
          </div>

          <RecipeFilterBar
            selectedCategories={selectedCategories}
            onToggleCategory={handleToggleCategory}
            useExpiring={useExpiring}
            onToggleExpiring={() => setUseExpiring(v => !v)}
            prompt={prompt}
            onPromptChange={setPrompt}
            onGenerate={handleGenerate}
            isGenerating={generateMutation.isPending}
          />
        </div>

        {/* Decorative divider — desktop only */}
        <div className="hidden xl:flex w-12 shrink-0 items-center justify-center py-6">
          <div className="relative h-full w-px bg-gradient-to-b from-transparent via-primary/45 to-transparent">
            <span className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[3px] border border-primary/45 bg-card ring-4 ring-primary/10 shadow-sm" />
            <span className="absolute left-1/2 top-[34%] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/60 ring-2 ring-primary/15" />
            <span className="absolute left-1/2 top-[66%] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/60 ring-2 ring-primary/15" />
          </div>
        </div>

        {/* RIGHT column: heart button (desktop) + card deck */}
        <div
          className={cn(
            'flex-1 min-h-0 flex flex-col overflow-hidden [@media(pointer:fine)]:overflow-y-auto relative',
            deckViewMode === 'grid' ? 'py-4 lg:py-6' : 'pt-3 pb-0 lg:py-6',
          )}
        >
          {/* Mobile hero + compact filter — hidden on lg+ */}
          <div className="lg:hidden px-4 sm:px-5 [@media(max-width:380px)]:px-3.5 pt-4 [@media(max-width:380px)]:pt-2.5 pb-5 [@media(max-width:380px)]:pb-3.5 flex flex-col gap-4 [@media(max-width:380px)]:gap-3">
            {/* Hero text */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <h1 className="font-display text-[clamp(1.55rem,6.3vw,2.05rem)] [@media(max-width:380px)]:text-[1.34rem] leading-[1.02] tracking-[-0.012em] text-[#221A15] [text-wrap:balance] drop-shadow-[0_1px_0_rgba(255,255,255,0.65)]">
                {t('recipes.mobileHeroTitle')}
              </h1>
              <p className="mt-2 [@media(max-width:380px)]:mt-1.5 text-[clamp(0.83rem,3.05vw,0.98rem)] [@media(max-width:380px)]:text-[12px] text-stone-500 leading-[1.4] tracking-[0.01em] [text-wrap:pretty]">
                {t('recipes.mobileHeroSub')}
              </p>
              <div className="mt-2.5 [@media(max-width:380px)]:mt-2 h-px w-18 [@media(max-width:380px)]:w-14 rounded-full bg-gradient-to-r from-primary/55 via-primary/25 to-transparent" />
            </motion.div>

            {/* Compact filter card — redesigned */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl [@media(max-width:380px)]:rounded-xl border border-stone-200/70 bg-gradient-to-b from-white to-[#FAF6F1] shadow-[0_3px_20px_-4px_rgba(28,22,18,0.10)] overflow-hidden"
            >
              {/* Preferences trigger (tap to open sheet) */}
              <button
                type="button"
                onClick={() => setFilterSheetOpen(true)}
                className="w-full text-left px-4 [@media(max-width:380px)]:px-3 pt-3.5 [@media(max-width:380px)]:pt-2.5 pb-3 [@media(max-width:380px)]:pb-2.5 active:bg-stone-50/60 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <SlidersHorizontal size={12} className="text-primary shrink-0 [@media(max-width:380px)]:w-[11px] [@media(max-width:380px)]:h-[11px]" />
                    <span className="text-[10.5px] [@media(max-width:380px)]:text-[9.5px] font-bold uppercase tracking-[0.09em] text-stone-400">
                      {t('recipes.preferencesLabel')}
                    </span>
                    {selectedCategories.length > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[9px] font-bold leading-none">
                        {selectedCategories.length}
                      </span>
                    )}
                    {useExpiring && (
                      <span className="inline-flex h-2 w-2 rounded-full bg-primary/80 ring-[3px] ring-primary/15" />
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 text-[11px] [@media(max-width:380px)]:text-[10px] text-primary font-semibold">
                    <span>{t('recipes.preferencesTapHint').split(' ').slice(0, 2).join(' ')}</span>
                    <ChevronRight size={13} className="opacity-70" />
                  </div>
                </div>

                {/* Show active filter chips — or prompt preview if none selected */}
                {selectedCategories.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 mt-2.5 [@media(max-width:380px)]:mt-2">
                    {selectedCategories.slice(0, 3).map(cat => (
                      <span
                        key={cat}
                        className="inline-flex items-center px-2.5 [@media(max-width:380px)]:px-2 py-1 [@media(max-width:380px)]:py-0.5 rounded-full bg-primary/10 text-primary text-[11px] [@media(max-width:380px)]:text-[10px] font-semibold"
                      >
                        {cat}
                      </span>
                    ))}
                    {selectedCategories.length > 3 && (
                      <span className="px-2.5 [@media(max-width:380px)]:px-2 py-1 [@media(max-width:380px)]:py-0.5 rounded-full bg-stone-100 text-stone-500 text-[11px] [@media(max-width:380px)]:text-[10px] font-medium">
                        +{selectedCategories.length - 3}
                      </span>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-[13px] [@media(max-width:380px)]:text-[12px] text-stone-400 truncate leading-snug">
                    {compactPromptPreview}
                  </p>
                )}
              </button>

              {/* Divider */}
              <div className="mx-4 [@media(max-width:380px)]:mx-3 h-px bg-stone-100" />

              {/* Generate button — full width, prominent */}
              <div className="px-3 [@media(max-width:380px)]:px-2.5 py-3 [@media(max-width:380px)]:py-2.5">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generateMutation.isPending}
                  className="w-full h-11 [@media(max-width:380px)]:h-10 bg-[#1C1612] text-white rounded-xl [@media(max-width:380px)]:rounded-lg font-semibold text-[13.5px] [@media(max-width:380px)]:text-[12.5px] flex items-center justify-center gap-2 hover:bg-stone-800 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generateMutation.isPending ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    >
                      <Sparkles size={15} className="text-primary" />
                    </motion.div>
                  ) : (
                    <Sparkles size={15} className="text-primary" />
                  )}
                  {generateMutation.isPending ? t('recipes.generating') : t('recipes.generateButton')}
                </button>
              </div>
            </motion.div>
          </div>

          {/* Mode-based deck width keeps stack/fan centered while letting grid breathe */}
          <div
            className={cn(
              'mx-auto w-full flex flex-col flex-1 min-h-0 [@media(pointer:fine)]:min-h-[520px]',
              deckViewMode === 'grid' ? 'max-w-[1260px]' : 'max-w-[920px]'
            )}
          >
            {/* RecipeCardDeck — vertically centered, no items-center (avoids w-full collapse) */}
            <div
              className={cn(
                'flex-1 min-h-0 flex flex-col overflow-visible',
                deckViewMode === 'grid'
                  ? 'justify-start lg:justify-center'
                  : 'justify-center [@media(min-height:900px)]:justify-start'
              )}
            >
              <RecipeCardDeck
                key={recipeDeckKey}
                recipes={recipes}
                isGenerating={generateMutation.isPending}
                sourceMode={selectedCategories.join(',') || (useExpiring ? 'expiring' : 'feeling')}
                sourcePrompt={prompt || undefined}
                onGenerateMore={handleGenerate}
                heartRef={heartRef}
                onHeartPulse={handleHeartPulse}
                onViewModeChange={setDeckViewMode}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filters sheet for sm/md */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="bottom" className="lg:hidden rounded-t-2xl max-h-[88dvh] flex flex-col p-0 pb-safe">
          <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
            <SheetTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal size={16} className="text-primary" />
              {t('recipes.preferencesLabel')}
            </SheetTitle>
            <p className="text-xs text-stone-500 leading-relaxed">{t('recipes.subtitle')}</p>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5">
            <RecipeFilterBar
              selectedCategories={selectedCategories}
              onToggleCategory={handleToggleCategory}
              useExpiring={useExpiring}
              onToggleExpiring={() => setUseExpiring(v => !v)}
              prompt={prompt}
              onPromptChange={setPrompt}
              onGenerate={handleGenerateAndCloseFilters}
              isGenerating={generateMutation.isPending}
              className="border-stone-200 shadow-none"
            />
          </div>
        </SheetContent>
      </Sheet>

      <HeartCollectionPanel
        open={heartPanelOpen}
        onClose={() => setHeartPanelOpen(false)}
      />
    </div>
  )
}
