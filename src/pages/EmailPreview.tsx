import { useParams, useNavigate } from 'react-router-dom'
import { useJob } from '../hooks/useJob'
import { useHitlAction } from '../hooks/useHitlAction'
import { getPendingIntervention, detectHitlType } from '../utils/hitl'
import { getCustomerName } from '../utils/status'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'

export function EmailPreview() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { data: job, isLoading } = useJob(jobId ? parseInt(jobId) : null)
  const { mutateAsync, isPending } = useHitlAction()

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Spinner size="lg" /></div>
  }
  if (!job) {
    return <div style={{ padding: 40 }}>Job not found.</div>
  }

  const pending = getPendingIntervention(job.interventions)
  const hitlType = pending ? detectHitlType(pending) : null
  const hasEmailAction = pending?.interrupt.actions.some((a) => a.id === 'send_email') ?? false

  if (!pending || (hitlType !== 3 && !hasEmailAction)) {
    return (
      <div className="banner banner-yellow">
        <div className="banner-content">This job is not in Email Preview stage.</div>
      </div>
    )
  }

  const emailHtml = typeof pending.interrupt.details.ai_response === 'string'
    ? pending.interrupt.details.ai_response : ''
  const summary = pending.interrupt.details.summary
  const recipient = getCustomerName(job)
  const customer = recipient

  async function handleAction(action: string) {
    if (!pending) return
    await mutateAsync({ id: pending.id, action })
    if (action === 'send_email') {
      navigate(`/audit/${job!.id}`)
    } else {
      navigate('/pipeline')
    }
  }

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="banner banner-purple" style={{ marginBottom: 16 }}>
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
        </svg>
        <div className="banner-content">
          <div className="banner-title">#RFQ-{job.id} · {customer}</div>
          {summary && <div style={{ marginTop: 2 }}>{summary}</div>}
        </div>
      </div>

      <div className="form-card" style={{ marginBottom: 16 }}>
        <div className="recipient-row">
          <span className="recipient-label">To:</span>
          <span className="recipient-value">{recipient}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span className="ai-tag">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
            </svg>
            AI Generated
          </span>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Preview only — no changes can be made</span>
        </div>

        <div className="email-preview-box">
          <iframe
            className="email-preview-iframe"
            sandbox="allow-same-origin"
            srcDoc={emailHtml}
            title="Email Preview"
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <Button variant="green" loading={isPending} onClick={() => handleAction('send_email')}>
          Send Email
        </Button>
        <Button variant="red-outline" disabled={isPending} onClick={() => handleAction('end')}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
