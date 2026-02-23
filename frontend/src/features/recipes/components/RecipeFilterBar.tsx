import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const CATEGORIES = [
  'Quick & Easy', 'High Protein', 'Vegetarian', 'Vegan', 'Desserts',
  'Asian', 'Italian', 'Comfort Food', 'Pantry Staples', 'High Pantry Match',
  'Budget Friendly', 'Meal Prep', 'Gluten Free', 'Low Carb',
]

interface Props {
  selectedCategories: string[]
  onToggleCategory: (cat: string) => void
  useExpiring: boolean
  onToggleExpiring: () => void
  prompt: string
  onPromptChange: (v: string) => void
  onGenerate: () => void
  isGenerating: boolean
}

export function RecipeFilterBar({
  selectedCategories,
  onToggleCategory,
  useExpiring,
  onToggleExpiring,
  prompt,
  onPromptChange,
  onGenerate,
  isGenerating,
}: Props) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-3">
      {/* Scrollable category chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden">
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategories.includes(cat)
          return (
            <button
              key={cat}
              type="button"
              onClick={() => onToggleCategory(cat)}
              className={`rounded-full border px-3 py-1.5 text-sm whitespace-nowrap transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card border-border hover:bg-muted text-foreground'
              }`}
            >
              {cat}
            </button>
          )
        })}
      </div>

      {/* Use expiring checkbox */}
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={useExpiring}
          onChange={onToggleExpiring}
          className="h-4 w-4 rounded border-border accent-foreground cursor-pointer"
        />
        <span className="text-sm text-foreground">{t('recipes.useExpiring')}</span>
      </label>

      {/* Custom prompt input */}
      <Input
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder={t('recipes.customPromptPlaceholder')}
      />

      {/* Generate button */}
      <Button
        className="w-full"
        onClick={onGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? t('recipes.generating') : t('recipes.generateButton')}
      </Button>
    </div>
  )
}
