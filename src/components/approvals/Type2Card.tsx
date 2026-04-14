import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { formatRelativeTime, formatDate } from '../../utils/time'
import { getTierInfo, getCustomerName } from '../../utils/status'
import { getCarriersFromTask } from '../../utils/carrier'
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
  const navigate = useNavigate()
  // Use full carriers from task if available (have markup/subtotal data)
  const taskCarriers = getCarriersFromTask(job)
  const carriers = taskCarriers.length > 0 ? taskCarriers : payload.carriers
  const carrier = carriers[0]
  const tierInfo = getTierInfo(job)
  const tier = tierInfo?.tierLabel ?? '—'
  const tierMin = TIER_MINIMUMS[tier] ?? 5
  const customer = getCustomerName(job)

  // Non-end actions mapped to carriers; end action becomes Reject button
  const carrierActions = intervention.interrupt.actions.filter(a => a.id !== 'end')
  const hasEndAction = intervention.interrupt.actions.some(a => a.id === 'end')
  const discount = carrier?.discount ?? null
  const hasDiscount = discount != null

  return (
    <div className="approval-card">
      <div className="approval-header">
        <div>
          <div className="approval-title">
            #RFQ-{job.id}
            <span style={{ marginLeft: 8 }}>
              <Badge variant="yellow" dot={false}>Select Carrier</Badge>
            </span>
            {hasDiscount && (
              <span style={{ marginLeft: 6 }}>
                <Badge variant="yellow" dot={false}>Price Negotiation</Badge>
              </span>
            )}
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>
            {formatRelativeTime(intervention.created_at ?? job.created_at)}
          </span>
          <button
            onClick={() => navigate(`/pipeline/${job.id}/quote`)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: '#2563eb', fontWeight: 500, padding: 0,
              textDecoration: 'underline', textUnderlineOffset: 2,
            }}
          >
            View Full Quote →
          </button>
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
          {hasDiscount && discount ? (
            <>
              <div className="approval-meta-item">
                <span className="approval-meta-label">Original Quote</span>
                <span className="approval-meta-value" style={{ textDecoration: 'line-through', color: 'var(--gray-400)' }}>
                  {carrier.currency_code} {discount.original_grand_total?.toLocaleString() ?? carrier.grand_total?.toLocaleString() ?? '—'}
                </span>
              </div>
              <div className="approval-meta-item">
                <span className="approval-meta-label">Discount</span>
                <span className="approval-meta-value" style={{ color: '#dc2626' }}>
                  −{discount.discount_pct?.toFixed(1)}% ({carrier.currency_code} {discount.discount_amount?.toLocaleString() ?? '—'})
                </span>
              </div>
              <div className="approval-meta-item">
                <span className="approval-meta-label">Adjusted Total</span>
                <span className="approval-meta-value" style={{ fontSize: 15, color: 'var(--dark)', fontWeight: 700 }}>
                  {carrier.currency_code} {discount.adjusted_grand_total?.toLocaleString() ?? '—'}
                </span>
              </div>
            </>
          ) : (
            <div className="approval-meta-item">
              <span className="approval-meta-label">Total Quote Value</span>
              <span className="approval-meta-value" style={{ fontSize: 15, color: 'var(--dark)' }}>
                {carrier.currency_code} {carrier.grand_total?.toLocaleString() ?? '—'}
              </span>
            </div>
          )}
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
        {carrierActions.map((action, i) => {
          const name = carriers[i]?.carrier
          return (
            <Button
              key={action.id}
              variant={i === 0 ? 'green' : 'yellow'}
              loading={i === 0 ? loading : false}
              disabled={loading}
              onClick={() => onAction(action.id)}
            >
              {name ? `Approve ${name}` : action.label}
            </Button>
          )
        })}
        {hasEndAction && (
          <Button variant="red-outline" disabled={loading} onClick={() => onAction('end')}>
            Manual Resolution
          </Button>
        )}
      </div>
    </div>
  )
}
