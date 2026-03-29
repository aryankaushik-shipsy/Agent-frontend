import { detectHitlType } from '../../utils/hitl'
import { formatRelativeTime } from '../../utils/time'
import type { Intervention } from '../../types/job'

const TYPE_LABELS: Record<number, string> = {
  1: 'Shipment Confirmation',
  2: 'Carrier Selection',
  3: 'Email Preview',
}

interface Props {
  intervention: Intervention
}

export function InterventionEntry({ intervention }: Props) {
  const hitlType = detectHitlType(intervention)
  const typeLabel = hitlType ? TYPE_LABELS[hitlType] : 'HITL Intervention'

  // completed = action_taken is set; pending = action_taken is null
  const isCompleted = intervention.action_taken != null
  let avatarClass = 'tl-avatar-yellow'
  if (isCompleted) {
    avatarClass = intervention.action_taken === 'end' ? 'tl-avatar-red' : 'tl-avatar-green'
  }

  const conf = intervention.interrupt.confidence
  const confPct = conf != null ? `${Math.round(conf * 100)}%` : null

  return (
    <div className="timeline-item">
      <div className={`tl-avatar ${avatarClass}`} style={{ fontSize: 9 }}>HITL</div>
      <div className="tl-body">
        <div className="tl-header">
          <div className="tl-title">{typeLabel}</div>
        </div>
        {intervention.interrupt.question && (
          <div className="tl-summary" style={{ fontStyle: 'italic' }}>
            {intervention.interrupt.question}
          </div>
        )}
        {intervention.interrupt.recommendation && (
          <div className="tl-summary">{intervention.interrupt.recommendation}</div>
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
