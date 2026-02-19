import { apiClient } from '@/shared/lib/axios'
import type { AgentActionRequest, AgentActionResponse, PhotoRecognizeRequest, PhotoRecognizeResponse } from '@/shared/lib/api.types'

export async function postAgentAction(data: AgentActionRequest): Promise<AgentActionResponse> {
  const response = await apiClient.post<AgentActionResponse>('/api/v1/agent/action', data)
  return response.data
}

export async function postPhotoRecognize(data: PhotoRecognizeRequest): Promise<PhotoRecognizeResponse> {
  const response = await apiClient.post<PhotoRecognizeResponse>('/api/v1/agent/photo-recognize', data)
  return response.data
}
