import { detectHitlSubtype } from '../../utils/hitl'
import { formatRelativeTime } from '../../utils/time'
import type { Intervention } from '../../types/job'
import type { HitlSubtype } from '../../types/hitl'

const TYPE_LABELS: Record<HitlSubtype, string> = {
  type1: 'Shipment Confirmation',
  type2_step0: 'Carrier Selection',
  type2_step1: 'Price Review',
  type2_step2: 'Final Approval',
  type3: 'Email Preview',
  vendor_rfq: 'Vendor RFQ Standby',
}

interface Props {
  intervention: Intervention
}

export function InterventionEntry({ intervention }: Props) {
  const subtype = detectHitlSubtype(intervention)
  const typeLabel = subtype ? TYPE_LABELS[subtype] : 'HITL Intervention'

  // completed = action_taken is set; pending = action_taken is null
  const isCompleted = intervention.action_taken != null
  let avatarClass = 'tl-avatar-yellow'
  if (isCompleted) {
    avatarClass = intervention.action_taken === 'end' ? 'tl-avatar-red' : 'tl-avatar-green'
  }

  // Prefer new structured payload; fall back to legacy interrupt fields
  const confidence = intervention.interrupt_message?.context?.confidence_score ?? intervention.interrupt?.confidence
  const confPct = confidence != null ? `${Math.round(confidence * 100)}%` : null
  const recommendation = intervention.interrupt_message?.context?.recommendation ?? intervention.interrupt?.recommendation
  const question = intervention.interrupt?.question

  return (
    <div className="timeline-item">
      <div className={`tl-avatar ${avatarClass}`} style={{ fontSize: 9 }}>HITL</div>
      <div className="tl-body">
        <div className="tl-header">
          <div className="tl-title">{typeLabel}</div>
        </div>
        {question && (
          <div className="tl-summary" style={{ fontStyle: 'italic' }}>
            {question}
          </div>
        )}
        {recommendation && (
          <div className="tl-summary">{recommendation}</div>
        )}
        <div className="tl-meta">
          {confPct && <span>Confidence: {confPct}</span>}
          {intervention.action_taken && (
            <span>Decision: <strong>{intervention.action_taken}</strong></span>
          )}
          {intervention.action_taken_by_user_name && (
            <span>By: {intervention.action_taken_by_user_name}</span>
          )}
          {intervention.action_taken_at && (
            <span>{formatRelativeTime(intervention.action_taken_at)}</span>
          )}
        </div>
      </div>
    </div>
  )
}
