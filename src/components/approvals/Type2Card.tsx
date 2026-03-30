import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { formatRelativeTime, formatDate } from '../../utils/time'
import { getTierFromTasks, getCustomerName } from '../../utils/status'
import { isAboveThreshold } from '../../utils/margin'
import { TIER_MINIMUMS } from '../../constants'
import type { JobDetail, Intervention } from '../../types/job'
import type { Type2Payload } from '../../types/hitl'

interface Props {
  job: JobDetail
  intervention: Intervention
  payload: Type2Payload
  onAction: (action: string) => void
  loading: boolean
}

export function Type2Card({ job, intervention, payload, onAction, loading }: Props) {
  const carrier = payload.carriers[0]
  const hasSecond = payload.carriers.length > 1
  const customer = getCustomerName(job)
  const tier = getTierFromTasks(job)
  const tierMin = TIER_MINIMUMS[tier] ?? 5

  return (
    <div className="approval-card">
      <div className="approval-header">
        <div>
          <div className="approval-title">
            #RFQ-{job.id}
            <span style={{ marginLeft: 8 }}>
              <Badge variant="yellow" dot={false}>Select Carrier</Badge>
            </span>
            {carrier && isAboveThreshold(carrier.grand_total) && (
              <span style={{ marginLeft: 6 }}>
                <Badge variant="red" dot={false}>Above $5K</Badge>
              </span>
            )}
          </div>
          <div className="approval-sub">
            {customer} · {payload.origin ?? '—'} → {payload.destination ?? '—'} · {payload.weight_kg ?? '—'} kg
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
          {formatRelativeTime(job.created_at)}
        </div>
      </div>

      {carrier && (
        <div className="approval-meta">
          <div className="approval-meta-item">
            <span className="approval-meta-label">Customer Tier</span>
            <span className="approval-meta-value">{tier}</span>
          </div>
          <div className="approval-meta-item">
            <span className="approval-meta-label">Recommended Carrier</span>
            <span className="approval-meta-value">{carrier.carrier}</span>
          </div>
          <div className="approval-meta-item">
            <span className="approval-meta-label">Total Quote Value</span>
            <span className="approval-meta-value" style={{ fontSize: 15, color: 'var(--dark)' }}>
              {carrier.currency_code} {carrier.grand_total?.toLocaleString() ?? '—'}
            </span>
          </div>
          <div className="approval-meta-item">
            <span className="approval-meta-label">Base Cost</span>
            <span className="approval-meta-value">
              {carrier.currency_code} {(carrier.subtotal_before_markup ?? carrier.subtotal)?.toLocaleString() ?? '—'}
            </span>
          </div>
          <div className="approval-meta-item">
            <span className="approval-meta-label">Markup Applied</span>
            <span className="approval-meta-value">{carrier.markup_pct != null ? `${carrier.markup_pct}% (min: ${tierMin}%)` : '—'}</span>
          </div>
          <div className="approval-meta-item">
            <span className="approval-meta-label">Margin $</span>
            <span className="approval-meta-value">{carrier.currency_code} {carrier.markup_amount?.toLocaleString() ?? '—'}</span>
          </div>
          <div className="approval-meta-item">
            <span className="approval-meta-label">Quote Validity</span>
            <span className="approval-meta-value">
              {carrier.validity_date ? formatDate(carrier.validity_date) : '—'}
            </span>
          </div>
        </div>
      )}

      {intervention.interrupt.recommendation && (
        <div className="approval-rec">{intervention.interrupt.recommendation}</div>
      )}

      <div className="approval-actions">
        <Button variant="green" loading={loading} onClick={() => onAction('carrier_1')}>
          Approve Carrier 1
        </Button>
        {hasSecond && (
          <Button variant="yellow" disabled={loading} onClick={() => onAction('carrier_2')}>
            Approve Carrier 2
          </Button>
        )}
        <Button variant="red-outline" disabled={loading} onClick={() => onAction('end')}>
          Reject
        </Button>
      </div>
    </div>
  )
}
