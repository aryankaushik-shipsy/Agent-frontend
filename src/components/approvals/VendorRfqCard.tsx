import { useNavigate } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import { formatRelativeTime, formatDate } from '../../utils/time'
import { getCustomerName, getShipmentFromHitl } from '../../utils/status'
import { getActionItems } from '../../utils/hitl'
import { ActionButtons } from './ActionButtons'
import type { JobDetail, Intervention } from '../../types/job'
import type { HITLActionRequest } from '../../api/hitl'

interface Props {
  job: JobDetail
  intervention: Intervention
  onAction: (body: HITLActionRequest) => void
  loading: boolean
}

/**
 * Read-only "Awaiting Vendor Rates" card. Surfaces when the agent has emailed
 * carriers for rates on a lane that has no entry in the rate master. The card
 * is policy-driven — every visible field is read from the interrupt payload
 * with a safe fallback. Action buttons render only if the policy supplies any.
 */
export function VendorRfqCard({ job, intervention, onAction, loading }: Props) {
  const navigate = useNavigate()
  const customer = getCustomerName(job)
  const msg = intervention.interrupt_message
  const ctx = msg?.context ?? {}
  const actionItems = getActionItems(intervention)

  const title = msg?.title ?? 'Awaiting Vendor Rates'
  const description = msg?.description

  // Vendor list — accept either a string[] of names or [{name, email?}].
  const rawVendors = (ctx as { vendors?: unknown }).vendors
  const vendors: string[] = Array.isArray(rawVendors)
    ? rawVendors.map((v) => {
        if (typeof v === 'string') return v
        if (v && typeof v === 'object' && 'name' in v) return String((v as { name: unknown }).name ?? '')
        return ''
      }).filter(Boolean)
    : []

  // Lane / mode / weight — derive from the same shipment source the rest of
  // the dashboard uses. Falls back through Type 1 / get_rate / input_json.
  const shipment = getShipmentFromHitl(job)
  const route = shipment?.origin && shipment?.destination
    ? `${shipment.origin} → ${shipment.destination}`
    : '—'
  const mode = shipment?.mode ?? '—'
  const weight = shipment?.weight_kg != null ? `${shipment.weight_kg} kg` : '—'

  // Optional structured context fields the policy may expose.
  const readyDate = (ctx as { ready_date?: string }).ready_date
  const validityRequested = (ctx as { validity_requested_days?: number }).validity_requested_days
  const expectedBy = (ctx as { expected_response_by?: string }).expected_response_by
  const sentAt = (ctx as { rfq_sent_at?: string }).rfq_sent_at ?? intervention.created_at

  return (
    <div className="approval-card">
      <div className="approval-header">
        <div>
          <div className="approval-title">
            #RFQ-{job.id}
            <span style={{ marginLeft: 8 }}>
              <Badge variant="yellow" dot={false}>{title}</Badge>
            </span>
          </div>
          <div className="approval-sub">
            {customer} · {route} · {mode} · {weight}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
            {formatRelativeTime(sentAt ?? job.created_at)}
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

      {description && (
        <div style={{ fontSize: 13, color: 'var(--gray-600)', marginBottom: 10, lineHeight: 1.5 }}>
          {description}
        </div>
      )}

      <div className="hitl-form" style={{ marginBottom: 10 }}>
        {sentAt && (
          <div className="hitl-form-row">
            <label className="hitl-form-label">RFQ Sent</label>
            <span className="hitl-form-static">{formatRelativeTime(sentAt)}</span>
          </div>
        )}
        {readyDate && (
          <div className="hitl-form-row">
            <label className="hitl-form-label">Ready Date</label>
            <span className="hitl-form-static">{formatDate(readyDate)}</span>
          </div>
        )}
        {validityRequested != null && (
          <div className="hitl-form-row">
            <label className="hitl-form-label">Validity Requested</label>
            <span className="hitl-form-static">
              {validityRequested} day{validityRequested !== 1 ? 's' : ''}
            </span>
          </div>
        )}
        {expectedBy && (
          <div className="hitl-form-row">
            <label className="hitl-form-label">Expected By</label>
            <span className="hitl-form-static">{formatDate(expectedBy)}</span>
          </div>
        )}
      </div>

      {vendors.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 6 }}>
            Vendors contacted
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {vendors.map((name, i) => (
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

      {actionItems.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <ActionButtons
            actions={actionItems}
            loading={loading}
            buildBody={(item) => ({ action: item.id })}
            onSubmit={onAction}
          />
        </div>
      )}
    </div>
  )
}
