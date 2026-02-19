import { createFileRoute } from '@tanstack/react-router'
import { BarcodePage } from '../features/barcode/components/BarcodePage'

export const Route = createFileRoute('/_protected/barcode')({
  component: BarcodePage,
})
