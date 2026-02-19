import { createFileRoute } from '@tanstack/react-router'
import { HistoryPage } from '../features/history/components/HistoryPage'

export const Route = createFileRoute('/_protected/history')({
  component: HistoryPage,
})
