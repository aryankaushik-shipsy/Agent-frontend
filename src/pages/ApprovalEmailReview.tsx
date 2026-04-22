import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useJob } from '../hooks/useJob'
import { useHitlAction } from '../hooks/useHitlAction'
import { detectHitlSubtype, getPendingIntervention } from '../utils/hitl'
import { Type3Card } from '../components/approvals/Type3Card'
import { Spinner } from '../components/ui/Spinner'
import type { HITLActionRequest } from '../api/hitl'

/**
 * Dedicated Type 3 email-review page.
 *
 * Entered from the HITL Approvals list when the reviewer clicks "Review Email"
 * on a Type3SummaryCard. Renders the full Type3Card (with iframe preview +
 * edit toggle) on its own page so the email body has room to breathe; after
 * submit we redirect back to the dashboard so the reviewer's queue is the
 * next thing they see.
 */
export function ApprovalEmailReview() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: job, isLoading } = useJob(jobId ? parseInt(jobId) : null)
  const { mutateAsync } = useHitlAction()
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const pending = job ? getPendingIntervention(job.interventions) : undefined
  const subtype = pending ? detectHitlSubtype(pending) : null

  async function handleAction(body: HITLActionRequest) {
    if (!pending) return
    setSubmitting(true)
    try {
      await mutateAsync({ id: pending.id, ...body })
      if (job?.ticket_id) {
        // Bust the thread cache so the audit trail refetches immediately.
        queryClient.invalidateQueries({ queryKey: ['thread', job.ticket_id] })
      }
      setSubmitted(true)
      // Redirect to dashboard after submit — hook already invalidated the
      // jobs / insights / job-detail caches in its onSuccess, so the
      // approvals badge + recent-RFQs list will refresh on arrival.
      navigate('/')
    } finally {
      setSubmitting(false)
    }
  }

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Spinner size="lg" /></div>
  }

  if (!job) {
    return (
      <div className="banner banner-yellow">
        <div className="banner-content">Job not found.</div>
      </div>
    )
  }

  // If the action already submitted, we've already navigated; but in case
  // the navigation is pending or blocked, show an explicit confirmation so
  // the reviewer isn't staring at stale buttons.
  if (submitted || !pending || subtype !== 'type3') {
    return (
      <div className="banner banner-green" style={{ maxWidth: 720, margin: '0 auto' }}>
        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18, flexShrink: 0 }}>
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
        </svg>
        <div className="banner-content">
          Action submitted. Heading back to the dashboard…
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: '1px solid var(--gray-200)', borderRadius: 6,
            padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--gray-600)',
          }}
        >
          ← Back
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Email Review</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>#RFQ-{jobId}</div>
        </div>
      </div>

      <Type3Card
        job={job}
        intervention={pending}
        onAction={handleAction}
        loading={submitting}
      />
    </div>
  )
}
