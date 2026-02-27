import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

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
  className?: string
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
  className,
}: Props) {
  const { t } = useTranslation()

  return (
    <div className={cn('bg-white rounded-3xl shadow-sm border border-stone-100 p-4 sm:p-5 flex flex-col gap-4', className)}>
      {/* Prompt textarea */}
      <textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder={t('recipes.customPromptPlaceholder')}
        rows={2}
        className="w-full bg-[#F5EFE6] rounded-2xl p-3.5 text-[#1C1612] placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none text-sm leading-relaxed min-h-[104px]"
      />

      {/* Preferences label + chips */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-stone-400 uppercase tracking-wider">
            {t('recipes.preferencesLabel')}
          </p>
          {selectedCategories.length > 0 && (
            <span className="px-2 py-0.5 bg-primary text-white text-[10px] font-bold rounded-full">
              {selectedCategories.length}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategories.includes(cat)
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onToggleCategory(cat)}
                className={`rounded-full px-3.5 sm:px-4 py-1.5 sm:py-2 text-sm font-medium whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-primary text-white shadow-md shadow-primary/20'
                    : 'bg-[#F5EFE6] text-stone-600 hover:bg-[#EAE3D5]'
                }`}
              >
                {cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* Use expiring checkbox */}
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={useExpiring}
          onChange={onToggleExpiring}
          className="h-4 w-4 rounded border-stone-300 accent-primary cursor-pointer"
        />
        <span className="text-sm text-stone-600">{t('recipes.useExpiring')}</span>
      </label>

      {/* Generate button */}
      <button
        onClick={onGenerate}
        disabled={isGenerating}
        className="w-full py-3.5 bg-[#1C1612] text-white rounded-2xl font-semibold text-base flex items-center justify-center gap-2.5 hover:bg-stone-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isGenerating ? (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          >
            <Sparkles size={20} className="text-primary" />
          </motion.div>
        ) : (
          <Sparkles size={18} className="text-primary" />
        )}
        {isGenerating ? t('recipes.generating') : t('recipes.generateButton')}
      </button>
    </div>
  )
}
