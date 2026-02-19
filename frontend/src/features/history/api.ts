import { apiClient } from '@/shared/lib/axios'
import type { TransactionLogResponse } from '@/shared/lib/api.types'

export async function getLogs(limit = 100): Promise<TransactionLogResponse[]> {
  const response = await apiClient.get<TransactionLogResponse[]>(`/api/v1/logs?limit=${limit}`)
  return response.data
}
