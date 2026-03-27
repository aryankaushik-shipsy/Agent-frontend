import { useMutation, useQueryClient } from '@tanstack/react-query'
import { runAgent } from '../api/agent'
import type { AgentRunPayload } from '../types/api'

export function useRunAgent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload: AgentRunPayload) => runAgent(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}
