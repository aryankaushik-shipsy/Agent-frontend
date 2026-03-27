import { useMutation, useQueryClient } from '@tanstack/react-query'
import { submitHitlAction } from '../api/hitl'
import { useToast } from './useToast'

export function useHitlAction() {
  const queryClient = useQueryClient()
  const { showToast } = useToast()

  return useMutation({
    mutationFn: ({ id, action }: { id: number; action: string }) =>
      submitHitlAction(id, action),
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
