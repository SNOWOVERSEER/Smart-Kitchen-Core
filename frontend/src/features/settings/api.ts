import { apiClient } from '@/shared/lib/axios'
import type { AIConfigResponse, AddAIConfigRequest } from '@/shared/lib/api.types'

export async function getAIConfigs(): Promise<AIConfigResponse[]> {
  const response = await apiClient.get<AIConfigResponse[]>('/api/v1/settings/ai')
  return response.data
}

export async function addAIConfig(data: AddAIConfigRequest): Promise<AIConfigResponse> {
  const response = await apiClient.post<AIConfigResponse>('/api/v1/settings/ai', data)
  return response.data
}

export async function deleteAIConfig(provider: string): Promise<void> {
  await apiClient.delete(`/api/v1/settings/ai/${provider}`)
}

export async function activateProvider(provider: string): Promise<void> {
  await apiClient.put(`/api/v1/settings/ai/${provider}/activate`)
}
