import { useNavigate } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { formatRelativeTime } from '../../utils/time'
import { getCustomerName } from '../../utils/status'
import { getToolArgsData } from '../../utils/hitl'
import { stripHtml } from '../../utils/hitl'
import type { JobDetail, Intervention } from '../../types/job'

interface Props {
  job: JobDetail
  intervention: Intervention
}

/**
 * Compact Type 3 (email review) card for the HITL Approvals list.
 *
 * The full email preview + send/skip buttons live on the dedicated
 * `/approvals/:jobId/email` page. This card just shows enough context
 * for triage — subject + a one-line body excerpt — and a button to
 * open the full review.
 */
export function Type3SummaryCard({ job, intervention }: Props) {
  const navigate = useNavigate()
  const customer = getCustomerName(job)
  const toolArgs = getToolArgsData(intervention)
  const summary = intervention.interrupt_message?.context?.summary

  const subject = String(toolArgs?.args.subject ?? '—')
  const messageHtml = toolArgs?.args.message
  const excerpt = typeof messageHtml === 'string' ? stripHtml(messageHtml).slice(0, 160) : ''

  return (
    <div className="approval-card type-email">
      <div className="approval-header">
        <div>
          <div className="approval-title">
            #RFQ-{job.id}
            <span style={{ marginLeft: 8 }}>
              <Badge variant="purple" dot={false}>Email Review</Badge>
            </span>
          </div>
          <div className="approval-sub">{customer}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
            {formatRelativeTime(intervention.created_at ?? job.created_at)}
          </span>
        </div>
      </div>

      {summary && (
        <div style={{ fontSize: 13, color: 'var(--gray-700)', marginBottom: 10, lineHeight: 1.5 }}>
          {summary}
        </div>
      )}

      <div className="hitl-form-row" style={{ marginBottom: 6 }}>
        <label className="hitl-form-label">Subject</label>
        <span className="hitl-form-static" style={{ flex: 1 }}>{subject}</span>
      </div>

      {excerpt && (
        <div
          style={{
            fontSize: 12, color: 'var(--gray-500)',
            background: 'var(--gray-50)', padding: '8px 12px', borderRadius: 6,
            marginBottom: 10, lineHeight: 1.5,
          }}
        >
          {excerpt}{excerpt.length >= 160 ? '…' : ''}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="primary" onClick={() => navigate(`/approvals/${job.id}/email`)}>
          Review Email →
        </Button>
      </div>
    </div>
  )
}
