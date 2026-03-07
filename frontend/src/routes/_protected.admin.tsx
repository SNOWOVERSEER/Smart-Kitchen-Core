import { createFileRoute } from '@tanstack/react-router'
import { AdminPage } from '@/features/admin/components/AdminPage'

export const Route = createFileRoute('/_protected/admin')({
  component: AdminPage,
})
