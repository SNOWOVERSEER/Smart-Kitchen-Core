import { useQuery } from '@tanstack/react-query'
import { getAIConfigs } from '@/features/settings/api'

/** Returns the active AI provider string (e.g. "openai", "minimax_cn"), or undefined while loading. */
export function useActiveProvider() {
  const { data: configs } = useQuery({
    queryKey: ['ai-configs'],
    queryFn: getAIConfigs,
    staleTime: 5 * 60 * 1000,
  })

  const active = configs?.find((c) => c.is_active)
  return active?.provider
}

/** True when the active provider doesn't support multimodal (image) input. */
export function useSupportsVision() {
  const provider = useActiveProvider()
  if (provider === undefined) return true // default to showing while loading
  const NO_VISION = ['minimax', 'minimax_cn']
  return !NO_VISION.includes(provider)
}
