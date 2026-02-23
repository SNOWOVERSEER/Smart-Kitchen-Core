import { useRef, useState } from 'react'
import { Heart } from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useGenerateRecipes, useSavedRecipes } from '@/features/recipes/hooks/useRecipes'
import { RecipeFilterBar } from './RecipeFilterBar'
import { RecipeCardDeck } from './RecipeCardDeck'
import { HeartCollectionPanel } from './HeartCollectionPanel'
import toast from 'react-hot-toast'
import type { RecipeCard } from '@/shared/lib/api.types'

export function RecipesPage() {
  const { t } = useTranslation()
  const heartRef = useRef<HTMLButtonElement>(null)
  const [heartPulse, setHeartPulse] = useState(false)
  const [heartPanelOpen, setHeartPanelOpen] = useState(false)

  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [useExpiring, setUseExpiring] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [recipes, setRecipes] = useState<RecipeCard[]>([])

  const { data: savedRecipes } = useSavedRecipes()
  const savedCount = savedRecipes?.length ?? 0
  const generateMutation = useGenerateRecipes()

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border shrink-0">
        <h1 className="text-lg font-semibold text-foreground">{t('recipes.title')}</h1>
        <motion.button
          ref={heartRef}
          animate={heartPulse ? { scale: [1, 1.35, 1] } : { scale: 1 }}
          transition={{ duration: 0.4 }}
          onClick={() => setHeartPanelOpen(true)}
          className="relative p-2 rounded-full hover:bg-muted transition-colors"
          aria-label={t('recipes.savedRecipesPanel')}
        >
          <Heart className="w-5 h-5 text-foreground" />
          {savedCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {savedCount > 9 ? '9+' : savedCount}
            </span>
          )}
        </motion.button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
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

        {generateMutation.isPending ? (
          <div className="flex items-center justify-center py-12">
            <span className="text-sm text-muted-foreground">{t('common.loading')}</span>
          </div>
        ) : recipes.length > 0 ? (
          <RecipeCardDeck
            recipes={recipes}
            sourceMode={selectedCategories.join(',') || (useExpiring ? 'expiring' : 'feeling')}
            sourcePrompt={prompt || undefined}
            onGenerateMore={handleGenerate}
            heartRef={heartRef}
            onHeartPulse={handleHeartPulse}
          />
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
            <p className="text-sm font-medium text-foreground">{t('recipes.initialHint')}</p>
            <p className="text-xs text-muted-foreground">{t('recipes.initialHintSub')}</p>
          </div>
        )}
      </div>

      <HeartCollectionPanel
        open={heartPanelOpen}
        onClose={() => setHeartPanelOpen(false)}
      />
    </div>
  )
}
