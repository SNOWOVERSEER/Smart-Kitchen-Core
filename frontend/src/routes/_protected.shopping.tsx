import { createFileRoute } from '@tanstack/react-router'
import { ShoppingPage } from '@/features/shopping/components/ShoppingPage'

export const Route = createFileRoute('/_protected/shopping')({
  component: ShoppingPage,
})
