import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { formatRelativeTime, formatDate } from '../../utils/time'
import type { JobDetail, Intervention } from '../../types/job'
import type { Type1Payload } from '../../types/hitl'

interface Props {
  job: JobDetail
  intervention: Intervention
  payload: Type1Payload
  onAction: (action: string) => void
  loading: boolean
}

export function Type1Card({ job, intervention, payload, onAction, loading }: Props) {
  const item = payload.items[0]
  const customer = job.info?.company_name || job.info?.sender_email || '—'

  return (
    <div className="approval-card type-confirm">
      <div className="approval-header">
        <div>
          <div className="approval-title">
            #RFQ-{job.id}
            <span style={{ marginLeft: 8 }}>
              <Badge variant="blue" dot={false}>Confirm Shipment</Badge>
            </span>
          </div>
          <div className="approval-sub">
            {customer} · {item.origin} → {item.destination} · {item.mode} · {item.weight_kg} kg
          </div>
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-500)' }}>
          {formatRelativeTime(job.created_at)}
        </div>
      </div>

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
      </div>

      {intervention.interrupt.details.summary && (
        <div className="approval-rec">{intervention.interrupt.details.summary}</div>
      )}

      <div className="approval-actions">
        <Button variant="green" loading={loading} onClick={() => onAction('get_rate')}>
          Confirm & Fetch Rates
        </Button>
        <Button variant="red-outline" disabled={loading} onClick={() => onAction('end')}>
          Reject
        </Button>
      </div>
    </div>
  )
}
