import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Leaf, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useGenerateRecipes } from '@/features/recipes/hooks/useRecipes'
import { RecipeSwipeSession } from './RecipeSwipeSession'
import type { RecipeCard } from '@/shared/lib/api.types'

type Mode = 'expiring' | 'feeling'

export function DiscoverTab() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<Mode>('expiring')
  const [prompt, setPrompt] = useState('')
  const [recipes, setRecipes] = useState<RecipeCard[] | null>(null)

  const generateMutation = useGenerateRecipes()

  function handleGenerate() {
    generateMutation.mutate(
      { mode, prompt: mode === 'feeling' ? prompt : undefined },
      {
        onSuccess: (data) => {
          setRecipes(data.recipes)
        },
        onError: () => {
          toast.error(t('recipes.generateFailed'))
        },
      }
    )
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      {/* Mode selector */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setMode('expiring')}
          className={`flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors ${
            mode === 'expiring'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border bg-background text-foreground hover:bg-muted/50'
          }`}
        >
          <span className="flex items-center gap-2 font-medium text-sm">
            <Leaf className="w-4 h-4 shrink-0" />
            {t('recipes.modeExpiring')}
          </span>
          <span
            className={`text-xs leading-snug ${
              mode === 'expiring' ? 'text-primary-foreground/70' : 'text-muted-foreground'
            }`}
          >
            {t('recipes.modeExpiringSub')}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMode('feeling')}
          className={`flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors ${
            mode === 'feeling'
              ? 'bg-primary text-primary-foreground border-primary'
              : 'border-border bg-background text-foreground hover:bg-muted/50'
          }`}
        >
          <span className="flex items-center gap-2 font-medium text-sm">
            <Sparkles className="w-4 h-4 shrink-0" />
            {t('recipes.modeFeeling')}
          </span>
          <span
            className={`text-xs leading-snug ${
              mode === 'feeling' ? 'text-primary-foreground/70' : 'text-muted-foreground'
            }`}
          >
            {t('recipes.modeFeelingSub')}
          </span>
        </button>
      </div>

      {/* Prompt input (only for feeling mode) */}
      {mode === 'feeling' && (
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t('recipes.feelingPlaceholder')}
          className="h-10"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !generateMutation.isPending) handleGenerate()
          }}
        />
      )}

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={generateMutation.isPending || (mode === 'feeling' && !prompt.trim())}
        className="w-full h-10"
      >
        {generateMutation.isPending ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('recipes.generating')}
          </span>
        ) : (
          t('recipes.generateButton')
        )}
      </Button>

      {/* Swipe tip + session */}
      {recipes !== null && recipes.length > 0 && (
        <>
          <p className="text-xs text-center text-muted-foreground">{t('recipes.swipeTip')}</p>
          <RecipeSwipeSession
            recipes={recipes}
            sourceMode={mode}
            sourcePrompt={mode === 'feeling' ? prompt : undefined}
            onGenerateMore={handleGenerate}
          />
        </>
      )}
    </div>
  )
}
