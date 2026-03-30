import { useQueries } from '@tanstack/react-query'
import { getJobs } from '../api/jobs'
import { RFQ_WORKFLOW_ID } from '../constants'

const POLL_INTERVAL = 30_000

export function useBadgeCounts() {
  const results = useQueries({
    queries: [
      // Active pipeline jobs (running + queued) for this workflow
      {
        queryKey: ['jobs', { statuses: ['running', 'queued'], workflow_ids: [RFQ_WORKFLOW_ID], result_per_page: 1 }],
        queryFn: () => getJobs({ statuses: ['running', 'queued'], workflow_ids: [RFQ_WORKFLOW_ID], result_per_page: 1 }),
        refetchInterval: POLL_INTERVAL,
        staleTime: POLL_INTERVAL,
      },
      // Pending approvals scoped to this workflow only (insights endpoint is org-wide)
      {
        queryKey: ['jobs', { workflow_ids: [RFQ_WORKFLOW_ID], active_interventions: true, result_per_page: 1 }],
        queryFn: () => getJobs({ workflow_ids: [RFQ_WORKFLOW_ID], active_interventions: true, result_per_page: 1 }),
        refetchInterval: POLL_INTERVAL,
        staleTime: POLL_INTERVAL,
      },
    ],
  })

  const pipelineCount  = results[0].data?.total ?? 0
  const approvalsCount = results[1].data?.total ?? 0

  return { pipelineCount, approvalsCount }
}
