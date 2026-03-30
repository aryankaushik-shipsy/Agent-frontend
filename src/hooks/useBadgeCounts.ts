import { useQueries } from '@tanstack/react-query'
import { getJobs } from '../api/jobs'
import { getInsights } from '../api/insights'
import { presetToRange } from '../components/pipeline/DateRangeFilter'
import { RFQ_WORKFLOW_ID } from '../constants'

const POLL_INTERVAL = 30_000

export function useBadgeCounts() {
  // Use local-time "today" range — same as Dashboard so they share the insights cache entry
  const { from, to } = presetToRange('today')

  const results = useQueries({
    queries: [
      {
        queryKey: ['jobs', { statuses: ['running', 'queued'], workflow_ids: [RFQ_WORKFLOW_ID], result_per_page: 1 }],
        queryFn: () => getJobs({ statuses: ['running', 'queued'], workflow_ids: [RFQ_WORKFLOW_ID], result_per_page: 1 }),
        refetchInterval: POLL_INTERVAL,
        staleTime: POLL_INTERVAL,
      },
      {
        queryKey: ['insights', from, to],
        queryFn: () => getInsights(from, to),
        refetchInterval: POLL_INTERVAL,
        staleTime: POLL_INTERVAL,
      },
    ],
  })

  const pipelineCount = results[0].data?.total ?? 0
  const approvalsCount = results[1].data?.active_interventions ?? 0

  return { pipelineCount, approvalsCount }
}
