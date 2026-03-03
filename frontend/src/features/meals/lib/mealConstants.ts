import { Coffee, Sun, Moon, Cookie, type LucideIcon } from 'lucide-react'

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export const MEAL_TYPE_CONFIG: Record<MealType, {
  icon: LucideIcon
  gradient: string
  bgLight: string
  textColor: string
  heroGradient: string
}> = {
  breakfast: { icon: Coffee, gradient: 'from-amber-300 to-orange-400', bgLight: 'bg-amber-50', textColor: 'text-amber-700', heroGradient: 'from-amber-100 via-orange-50 to-amber-50' },
  lunch: { icon: Sun, gradient: 'from-emerald-300 to-green-400', bgLight: 'bg-emerald-50', textColor: 'text-emerald-700', heroGradient: 'from-emerald-100 via-green-50 to-emerald-50' },
  dinner: { icon: Moon, gradient: 'from-blue-300 to-indigo-400', bgLight: 'bg-blue-50', textColor: 'text-blue-700', heroGradient: 'from-blue-100 via-indigo-50 to-blue-50' },
  snack: { icon: Cookie, gradient: 'from-purple-300 to-violet-400', bgLight: 'bg-purple-50', textColor: 'text-purple-700', heroGradient: 'from-purple-100 via-violet-50 to-purple-50' },
}

export const EASE_OUT_EXPO: [number, number, number, number] = [0.22, 1, 0.36, 1]
export const INTERACTIVE_SPRING = { type: 'spring' as const, stiffness: 440, damping: 34 }
export const LAYOUT_SPRING = { type: 'spring' as const, stiffness: 200, damping: 28 }
