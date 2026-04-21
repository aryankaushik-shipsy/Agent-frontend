import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useJobs } from '../hooks/useJobs'
import { useJobDetails } from '../hooks/useJobDetails'
import { useHitlAction } from '../hooks/useHitlAction'
import { detectHitlSubtype, getPendingIntervention } from '../utils/hitl'
import type { HITLActionRequest } from '../api/hitl'
import { WarningBanner } from '../components/approvals/WarningBanner'
import { ApprovalCardRouter } from '../components/approvals/ApprovalCardRouter'
import { Type3SummaryCard } from '../components/approvals/Type3SummaryCard'
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

  async function handleAction(interventionId: number, body: HITLActionRequest) {
    setLoadingId(interventionId)
    // Optimistically hide the card BEFORE the network round-trip so the
    // submit button disappears immediately — no re-click possible while
    // the request is in flight and no flicker when the refetch lands.
    const jobDetail = details.find((d) =>
      (d.interventions ?? []).some((i) => i.id === interventionId)
    )
    if (jobDetail) {
      setRemovedIds((prev) => new Set([...prev, jobDetail.id]))
    }
    try {
      await mutateAsync({ id: interventionId, ...body })
      if (jobDetail) {
        queryClient.invalidateQueries({ queryKey: ['job', jobDetail.id] })
      }
    } catch {
      // If the submission failed, restore the card so the reviewer can retry.
      if (jobDetail) {
        setRemovedIds((prev) => {
          const next = new Set(prev)
          next.delete(jobDetail.id)
          return next
        })
      }
    } finally {
      setLoadingId(null)
    }
  }

  // Show all pending intervention types — Type 3 email review is now handled inline
  const visibleDetails = details.filter((d) => {
    if (removedIds.has(d.id)) return false
    const pending = getPendingIntervention(d.interventions)
    return pending != null
  })
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

      {visibleDetails.map((job) => {
        // Type 3 (email review) gets a compact summary card here; the full
        // preview + send/skip controls live on the dedicated review page
        // so the email body isn't squeezed into the list layout.
        const pending = getPendingIntervention(job.interventions)
        const subtype = pending ? detectHitlSubtype(pending) : null
        if (pending && subtype === 'type3') {
          return <Type3SummaryCard key={job.id} job={job} intervention={pending} />
        }
        return (
          <ApprovalCardRouter
            key={job.id}
            job={job}
            onAction={handleAction}
            loadingId={loadingId}
          />
        )
      })}
    </div>
  )
}
