import { apiClient } from '@/shared/lib/axios'

export interface SubscriptionData {
  tier: 'free' | 'supporter' | 'byok'
  prompt_credits: number
  bonus_credits: number
  total_credits: number
  has_api_key: boolean
  trial_ends_at: string | null
  current_period_end: string | null
}

export async function getSubscription(): Promise<SubscriptionData> {
  const response = await apiClient.get<SubscriptionData>('/api/v1/subscription')
  return response.data
}

export async function createCheckoutSession(couponCode?: string): Promise<string> {
  const response = await apiClient.post<{ checkout_url: string }>(
    '/api/v1/subscription/checkout',
    { coupon_code: couponCode },
  )
  return response.data.checkout_url
}

export async function createPortalSession(): Promise<string> {
  const response = await apiClient.post<{ portal_url: string }>(
    '/api/v1/subscription/portal',
  )
  return response.data.portal_url
}

export async function redeemVoucher(code: string): Promise<{
  type: string
  value: number
  message: string
}> {
  const response = await apiClient.post('/api/v1/voucher/redeem', { code })
  return response.data
}
