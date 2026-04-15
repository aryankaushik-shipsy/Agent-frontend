import { useParams, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useJob } from '../hooks/useJob'
import { useHitlAction } from '../hooks/useHitlAction'
import type { HITLActionRequest } from '../api/hitl'
import { ApprovalCardRouter } from '../components/approvals/ApprovalCardRouter'
import { Spinner } from '../components/ui/Spinner'

export function ApprovalDetail() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: job, isLoading } = useJob(jobId ? parseInt(jobId) : null)
  const { mutateAsync } = useHitlAction()
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [done, setDone] = useState(false)

  async function handleAction(interventionId: number, body: HITLActionRequest) {
    setLoadingId(interventionId)
    try {
      await mutateAsync({ id: interventionId, ...body })
      queryClient.invalidateQueries({ queryKey: ['job', job?.id] })
      setDone(true)
    } finally {
      setLoadingId(null)
    }
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
          <div style={{ fontSize: 18, fontWeight: 700 }}>Review Approval</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>#RFQ-{jobId}</div>
        </div>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: 48 }}><Spinner size="lg" /></div>
      )}

      {!isLoading && done && (
        <div className="card card-body" style={{ textAlign: 'center', padding: 48, color: 'var(--gray-500)' }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Action submitted</div>
          <div style={{ fontSize: 13 }}>The agent will continue processing this RFQ.</div>
          <button
            onClick={() => navigate('/pipeline')}
            style={{ marginTop: 16, padding: '8px 20px', borderRadius: 6, border: '1px solid var(--gray-200)', background: 'none', cursor: 'pointer', fontSize: 13 }}
          >
            Back to Pipeline
          </button>
        </div>
      )}

      {!isLoading && !done && job && (
        <ApprovalCardRouter
          job={job}
          onAction={handleAction}
          loadingId={loadingId}
        />
      )}

      {!isLoading && !done && !job && (
        <div className="banner banner-yellow">
          <div className="banner-content">Job not found or no pending approval.</div>
        </div>
      )}
    </div>
  )
}
