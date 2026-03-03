import { createFileRoute } from '@tanstack/react-router'
import { MealsPage } from '@/features/meals/components/MealsPage'

export const Route = createFileRoute('/_protected/meals')({
  component: MealsPage,
})
