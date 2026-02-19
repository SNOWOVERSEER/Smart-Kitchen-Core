import { differenceInDays, parseISO } from 'date-fns'

export type ExpiryStatus = 'critical' | 'warning' | 'safe' | 'none'

export function expiryStatus(dateStr: string | null | undefined): ExpiryStatus {
  if (!dateStr) return 'none'
  const days = differenceInDays(parseISO(dateStr), new Date())
  if (days < 0) return 'critical'
  if (days < 3) return 'critical'
  if (days <= 7) return 'warning'
  return 'safe'
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const date = parseISO(dateStr)
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function formatQuantity(qty: number, unit: string): string {
  const formatted = qty % 1 === 0 ? qty.toString() : qty.toFixed(1)
  return `${formatted} ${unit}`
}

export function expiryLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return 'No expiry'
  const days = differenceInDays(parseISO(dateStr), new Date())
  if (days < 0) return 'Expired'
  if (days === 0) return 'Expires today'
  if (days === 1) return 'Expires tomorrow'
  return `${days}d left`
}
