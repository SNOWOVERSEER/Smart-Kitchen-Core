import { apiClient } from '@/shared/lib/axios'

export interface AdminSubscription {
  id: number
  user_id: string
  tier: string
  prompt_credits: number
  bonus_credits: number
  payment_failed: boolean
  stripe_customer_id: string | null
  email: string | null
  display_name: string | null
  created_at: string
}

export interface UsageStat {
  date: string
  [action: string]: string | number
}

export interface AdminVoucher {
  id: number
  code: string
  type: string
  value: number
  max_uses: number | null
  used_count: number
  expires_at: string | null
  stripe_coupon_id: string | null
  created_at: string
}

export async function getAdminSubscriptions(page = 0): Promise<AdminSubscription[]> {
  const { data } = await apiClient.get<AdminSubscription[]>(`/api/v1/admin/subscriptions?page=${page}`)
  return data
}

export async function updateUserCredits(
  userId: string,
  credits: { prompt_credits?: number; bonus_credits?: number },
): Promise<AdminSubscription> {
  const { data } = await apiClient.patch<AdminSubscription>(
    `/api/v1/admin/subscriptions/${userId}/credits`,
    credits,
  )
  return data
}

export async function getUsageStats(days = 30): Promise<UsageStat[]> {
  const { data } = await apiClient.get<UsageStat[]>(`/api/v1/admin/usage-stats?days=${days}`)
  return data
}

export async function getAdminVouchers(): Promise<AdminVoucher[]> {
  const { data } = await apiClient.get<AdminVoucher[]>('/api/v1/admin/vouchers')
  return data
}

export async function createAdminVoucher(voucher: {
  code: string
  type: string
  value: number
  max_uses?: number
  expires_at?: string
}): Promise<AdminVoucher> {
  const { data } = await apiClient.post<AdminVoucher>('/api/v1/admin/vouchers', voucher)
  return data
}

export async function deleteAdminVoucher(id: number): Promise<void> {
  await apiClient.delete(`/api/v1/admin/vouchers/${id}`)
}
