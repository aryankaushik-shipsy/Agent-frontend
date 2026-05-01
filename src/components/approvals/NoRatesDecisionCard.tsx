import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { formatRelativeTime, formatDate } from '../../utils/time'
import { getCustomerName } from '../../utils/status'
import type { JobDetail, Intervention, InterruptAction } from '../../types/job'
import type { Type5Payload } from '../../types/hitl'

interface Props {
  job: JobDetail
  intervention: Intervention
  payload: Type5Payload
  onAction: (action: string) => void
  loading: boolean
}

// Map known policy action ids to a button variant + display label. Anything
// the policy emits beyond these falls through to a neutral primary button
// labelled with whatever the policy supplied.
const ACTION_PRESENTATION: Record<string, { variant: 'green' | 'primary' | 'yellow' | 'red-outline'; label: string }> = {
  send_vendor_rfq: { variant: 'green',       label: 'Get Rates from Vendor' },
  send_email:      { variant: 'primary',     label: 'Send Apology Email' },
  end:             { variant: 'red-outline', label: 'Manual Resolution' },
}

/**
 * "Rates Unavailable" decision card. Surfaces when the agent looked up the
 * lane in the rate master, got nothing back, and now needs the reviewer to
 * pick: (1) email carriers for vendor rates, (2) send the drafted apology
 * to the customer, or (3) end the job.
 *
 * Buttons are policy-driven — `intervention.interrupt.actions` decides what
 * actually renders, so a policy can add or remove options without a code
 * change. The apology HTML body is sandboxed inside an iframe (same pattern
 * as EmailPreview) so the embedded markup can't reach the parent document.
 */
export function NoRatesDecisionCard({ job, intervention, payload, onAction, loading }: Props) {
  const navigate = useNavigate()
  const item = payload.items?.[0]
  const customer = getCustomerName(job)
  const summary = intervention.interrupt.details.summary
  const recommendation = intervention.interrupt.recommendation

  const actions = intervention.interrupt.actions ?? []

  function presentation(action: InterruptAction) {
    return ACTION_PRESENTATION[action.id] ?? { variant: 'primary' as const, label: action.label || action.id }
  }

  return (
    <div className="approval-card">
      <div className="approval-header">
        <div>
          <div className="approval-title">
            #RFQ-{job.id}
            <span style={{ marginLeft: 8 }}>
              <Badge variant="yellow" dot={false}>Rates Unavailable</Badge>
            </span>
          </div>
          <div className="approval-sub">
            {customer}
            {item && ` · ${item.origin} → ${item.destination} · ${item.mode} · ${item.weight_kg} kg`}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
            {formatRelativeTime(intervention.created_at ?? job.created_at)}
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
        <div style={{ fontSize: 13, color: 'var(--gray-700)', marginBottom: 12, lineHeight: 1.5 }}>
          {summary}
        </div>
      )}

      {item && (
        <div className="approval-meta">
          <div className="approval-meta-item">
            <span className="approval-meta-label">Shipment Date</span>
            <span className="approval-meta-value">{formatDate(item.date)}</span>
          </div>
          <div className="approval-meta-item">
            <span className="approval-meta-label">Dimensions</span>
            <span className="approval-meta-value">{item.length_cm} × {item.width_cm} × {item.height_cm} cm</span>
          </div>
          <div className="approval-meta-item">
            <span className="approval-meta-label">Pieces</span>
            <span className="approval-meta-value">{item.number_of_boxes}</span>
          </div>
          {item.commodity && (
            <div className="approval-meta-item">
              <span className="approval-meta-label">Commodity</span>
              <span className="approval-meta-value">{item.commodity}</span>
            </div>
          )}
          {item.incoterms && (
            <div className="approval-meta-item">
              <span className="approval-meta-label">Incoterms</span>
              <span className="approval-meta-value">{item.incoterms}</span>
            </div>
          )}
        </div>
      )}

      {payload.message && (
        <div style={{ marginTop: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{
              fontSize: 11, fontWeight: 600, color: 'var(--gray-500)',
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              Apology Email Draft
            </span>
            <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
              · sent only if you choose Send Apology Email
            </span>
          </div>
          <iframe
            sandbox=""
            srcDoc={payload.message}
            title="Apology Email Preview"
            style={{
              width: '100%', minHeight: 180, maxHeight: 260,
              border: '1px solid var(--gray-200)', borderRadius: 6,
              background: 'var(--gray-50)',
            }}
          />
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '10px 12px', background: '#fffbeb',
        border: '1px solid #fde68a', borderRadius: 6, marginBottom: 12,
        fontSize: 12, color: '#92400e', lineHeight: 1.5,
      }}>
        <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14, color: '#d97706', flexShrink: 0, marginTop: 2 }}>
          <path d="M12 2a10 10 0 100 20A10 10 0 0012 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
        </svg>
        <span>
          The internal rate master has no entry for this lane. Choose how to proceed.
        </span>
      </div>

      {recommendation && (
        <div className="approval-rec">{recommendation}</div>
      )}

      <div className="approval-actions">
        {actions.map((action) => {
          const { variant, label } = presentation(action)
          return (
            <Button
              key={action.id}
              variant={variant}
              loading={variant === 'green' ? loading : false}
              disabled={loading}
              onClick={() => onAction(action.id)}
            >
              {label}
            </Button>
          )
        })}
      </div>
    </div>
  )
}
