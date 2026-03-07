import { apiClient, baseURL, refreshAccessToken } from '@/shared/lib/axios'
import { useAuthStore } from '@/shared/stores/authStore'
import type { AgentActionRequest, AgentActionResponse, PhotoRecognizeRequest, PhotoRecognizeResponse } from '@/shared/lib/api.types'

export async function postAgentAction(data: AgentActionRequest): Promise<AgentActionResponse> {
  const response = await apiClient.post<AgentActionResponse>('/api/v1/agent/action', data)
  return response.data
}

export async function postPhotoRecognize(data: PhotoRecognizeRequest): Promise<PhotoRecognizeResponse> {
  const response = await apiClient.post<PhotoRecognizeResponse>('/api/v1/agent/photo-recognize', data)
  return response.data
}

interface StreamCallbacks {
  onToken: (token: string) => void
  onText: (content: string) => void
  onNode: (node: string) => void
  onThreadId: (threadId: string) => void
  onResponding?: () => void
}

async function doStreamFetch(
  data: AgentActionRequest,
  token: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<AgentActionResponse> {
  const res = await fetch(`${baseURL}/api/v1/agent/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(data),
    signal,
  })

  if (!res.ok) {
    throw Object.assign(new Error(`Stream request failed: ${res.status}`), { status: res.status })
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalData: AgentActionResponse | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // Parse complete SSE messages from buffer
    let boundary = buffer.indexOf('\n\n')
    while (boundary !== -1) {
      const raw = buffer.slice(0, boundary)
      buffer = buffer.slice(boundary + 2)

      let eventType = ''
      let eventData = ''
      for (const line of raw.split('\n')) {
        if (line.startsWith('event: ')) eventType = line.slice(7)
        else if (line.startsWith('data: ')) eventData = line.slice(6)
      }

      if (!eventType) {
        boundary = buffer.indexOf('\n\n')
        continue
      }

      // `responding` event has no data payload
      if (eventType === 'responding') {
        callbacks.onResponding?.()
        boundary = buffer.indexOf('\n\n')
        continue
      }

      if (!eventData) {
        boundary = buffer.indexOf('\n\n')
        continue
      }

      try {
        const parsed = JSON.parse(eventData) as Record<string, unknown>
        switch (eventType) {
          case 'token':
            callbacks.onToken((parsed as { content: string }).content)
            break
          case 'text':
            callbacks.onText((parsed as { content: string }).content)
            break
          case 'node':
            callbacks.onNode((parsed as { node: string }).node)
            break
          case 'thread_id':
            callbacks.onThreadId((parsed as { thread_id: string }).thread_id)
            break
          case 'done':
            finalData = parsed as unknown as AgentActionResponse
            break
        }
      } catch {
        // skip malformed JSON
      }

      boundary = buffer.indexOf('\n\n')
    }
  }

  if (!finalData) {
    throw new Error('Stream ended without done event')
  }
  return finalData
}

export async function streamAgentAction(
  data: AgentActionRequest,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
): Promise<AgentActionResponse> {
  const token = useAuthStore.getState().access_token
  if (!token) throw new Error('Not authenticated')

  try {
    return await doStreamFetch(data, token, callbacks, signal)
  } catch (err) {
    // 401 → refresh and retry once
    if (err instanceof Error && 'status' in err && (err as { status: number }).status === 401) {
      const newToken = await refreshAccessToken()
      return doStreamFetch(data, newToken, callbacks, signal)
    }
    throw err
  }
}
