import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { formatRelativeTime, formatDate } from '../../utils/time'
import { getCustomerName } from '../../utils/status'
import type { JobDetail, Intervention } from '../../types/job'
import type { Type4Payload, VendorContact } from '../../types/hitl'

interface Props {
  job: JobDetail
  intervention: Intervention
  payload: Type4Payload
  onAction: (action: string) => void
  loading: boolean
}

/**
 * Read-only "Awaiting Vendor Rates" card. Surfaces when the agent has emailed
 * carriers for rates on a lane that has no entry in the rate master. Once a
 * vendor responds, the agent re-emits a Type 2 (carrier selection) and the
 * standard flow resumes.
 */
export function VendorRfqCard({ job, intervention, payload, onAction, loading }: Props) {
  const navigate = useNavigate()
  const customer = getCustomerName(job)

  const vendorNames: string[] = (payload.vendors ?? []).map((v) => {
    if (typeof v === 'string') return v
    return (v as VendorContact).name ?? ''
  }).filter(Boolean)

  const sentAt = payload.rfq_sent_at ?? intervention.created_at ?? job.created_at
  const summary = intervention.interrupt.details.summary

  // Surface any agent-declared actions (e.g. Resend RFQ / Manual Resolution).
  // We don't hardcode action ids — only render whichever the payload supplies.
  const actions = intervention.interrupt.actions ?? []

  return (
    <div className="approval-card">
      <div className="approval-header">
        <div>
          <div className="approval-title">
            #RFQ-{job.id}
            <span style={{ marginLeft: 8 }}>
              <Badge variant="yellow" dot={false}>Awaiting Vendor Rates</Badge>
            </span>
          </div>
          <div className="approval-sub">
            {customer}
            {payload.lane && ` · ${payload.lane}`}
            {payload.mode && ` · ${payload.mode}`}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
            {formatRelativeTime(sentAt)}
          </span>
          <button
            onClick={() => navigate(`/audit/${job.id}`)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: '#2563eb', fontWeight: 500, padding: 0,
              textDecoration: 'underline', textUnderlineOffset: 2,
            }}
          >
            View Audit Trail →
          </button>
        </div>
      </div>

      {summary && (
        <div style={{ fontSize: 13, color: 'var(--gray-700)', marginBottom: 10, lineHeight: 1.5 }}>
          {summary}
        </div>
      )}

      <div className="approval-meta">
        <div className="approval-meta-item">
          <span className="approval-meta-label">RFQ Sent</span>
          <span className="approval-meta-value">{formatRelativeTime(sentAt)}</span>
        </div>
        {payload.ready_date && (
          <div className="approval-meta-item">
            <span className="approval-meta-label">Ready Date</span>
            <span className="approval-meta-value">{formatDate(payload.ready_date)}</span>
          </div>
        )}
        {payload.validity_requested_days != null && (
          <div className="approval-meta-item">
            <span className="approval-meta-label">Validity Requested</span>
            <span className="approval-meta-value">
              {payload.validity_requested_days} day{payload.validity_requested_days !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        {payload.expected_response_by && (
          <div className="approval-meta-item">
            <span className="approval-meta-label">Expected By</span>
            <span className="approval-meta-value">{formatDate(payload.expected_response_by)}</span>
          </div>
        )}
      </div>

      {vendorNames.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 }}>
            Vendors contacted
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {vendorNames.map((name, i) => (
              <Badge key={i} variant="gray" dot={false}>{name}</Badge>
            ))}
          </div>
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '10px 12px', background: '#fffbeb',
        border: '1px solid #fde68a', borderRadius: 6,
        fontSize: 12, color: '#92400e', lineHeight: 1.5,
      }}>
        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14, color: '#d97706', flexShrink: 0, marginTop: 2 }}>
          <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
        <span>
          No rates were available in the master for this lane. The agent has emailed
          the carriers above and will resume automatically when at least one vendor
          responds with rates.
        </span>
      </div>

      {actions.length > 0 && (
        <div className="approval-actions" style={{ marginTop: 12 }}>
          {actions.map((a) => (
            <Button
              key={a.id}
              variant={a.id === 'end' ? 'red-outline' : 'ghost'}
              loading={loading && a.id !== 'end'}
              disabled={loading}
              onClick={() => onAction(a.id)}
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}
