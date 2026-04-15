import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submitHitlAction } from '../api/hitl'
import type { HITLActionRequest } from '../api/hitl'
import { useToast } from './useToast'

export function useHitlAction() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  return useMutation({
    mutationFn: ({ id, ...body }: { id: number } & HITLActionRequest) =>
      submitHitlAction(id, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Action failed. Please try again.'
      showToast(message, 'error')
    },
  })
}
