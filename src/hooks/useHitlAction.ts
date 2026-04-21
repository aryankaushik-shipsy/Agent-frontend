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
      // Invalidate every query that could still reflect the just-actioned
      // intervention. Without the `['job', id]` sweep, individual job-detail
      // caches stay stale long enough that the card can re-render with
      // `action_taken: null` (so its submit button is still clickable) until
      // the next poll or page reload. `refetchQueries` forces an immediate
      // re-pull instead of deferring until the query is next observed.
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
      queryClient.invalidateQueries({ queryKey: ['job'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      queryClient.refetchQueries({ queryKey: ['job'], type: 'active' })
      queryClient.refetchQueries({ queryKey: ['jobs'], type: 'active' })
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error ? err.message : 'Action failed. Please try again.'
      showToast(message, 'error')
    },
  })
}
