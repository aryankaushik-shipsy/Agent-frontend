import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useJobs } from '../hooks/useJobs'
import { useJobDetails } from '../hooks/useJobDetails'
import { useHitlAction } from '../hooks/useHitlAction'
import { WarningBanner } from '../components/approvals/WarningBanner'
import { ApprovalCardRouter } from '../components/approvals/ApprovalCardRouter'
import { Spinner } from '../components/ui/Spinner'
import { RFQ_WORKFLOW_ID } from '../constants'

export function HITLApprovals() {
  const queryClient = useQueryClient()

  const { data: jobsData, isLoading: jobsLoading } = useJobs(
    {
      workflow_ids: [RFQ_WORKFLOW_ID],
      active_interventions: true,
      result_per_page: 50,
      order_by: 'desc',
      sort_by: 'created_at',
    }
  )
  const jobs = jobsData?.jobs ?? []
  const { data: details, isLoading: detailsLoading } = useJobDetails(jobs.map((j) => j.id))

  const { mutateAsync } = useHitlAction()
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set())

  async function handleAction(interventionId: number, action: string) {
    setLoadingId(interventionId)
    try {
      await mutateAsync({ id: interventionId, action })
      // optimistically remove the job card
      const jobDetail = details.find((d) =>
        (d.interventions ?? []).some((i) => i.id === interventionId)
      )
      if (jobDetail) {
        setRemovedIds((prev) => new Set([...prev, jobDetail.id]))
        // also invalidate per-job cache
        queryClient.invalidateQueries({ queryKey: ['job', jobDetail.id] })
      }
    } finally {
      setLoadingId(null)
    }
  }

  const visibleDetails = details.filter((d) => !removedIds.has(d.id))
  const loading = jobsLoading || detailsLoading

  return (
    <div>
      <WarningBanner count={jobsData?.total ?? 0} />

      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spinner size="lg" />
        </div>
      )}

      {!loading && visibleDetails.length === 0 && (
        <div className="card card-body" style={{ textAlign: 'center', padding: '48px', color: 'var(--gray-400)' }}>
          <div style={{ marginBottom: 8, fontSize: 32 }}>✓</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-600)' }}>All caught up!</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>No pending approvals right now.</div>
        </div>
      )}

      {visibleDetails.map((job) => (
        <ApprovalCardRouter
          key={job.id}
          job={job}
          onAction={handleAction}
          loadingId={loadingId}
        />
      ))}
    </div>
  )
}
