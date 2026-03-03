import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  MEAL_TYPES,
  MEAL_TYPE_CONFIG,
} from '@/features/meals/lib/mealConstants'

export interface MealTypeSelectorProps {
  value: string | null
  onChange: (value: string | null) => void
}

export function MealTypeSelector({ value, onChange }: MealTypeSelectorProps) {
  const { t } = useTranslation()

  return (
    <div className="flex gap-2">
      {MEAL_TYPES.map((mt) => {
        const active = value === mt
        const config = MEAL_TYPE_CONFIG[mt]
        const Icon = config.icon

        return (
          <button
            key={mt}
            type="button"
            onClick={() => onChange(active ? null : mt)}
            className={cn(
              'flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all',
              active
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-transparent hover:bg-stone-50',
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-full bg-gradient-to-br flex items-center justify-center',
                config.gradient,
              )}
            >
              <Icon className="w-5 h-5 text-white" />
            </div>
            <span className="text-[11px] font-medium text-stone-600">
              {t(`meals.${mt}`, mt)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
