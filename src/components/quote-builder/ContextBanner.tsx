import type { JobDetail } from '../../types/job'
import type { Type1Payload } from '../../types/hitl'
import { getTierFromTasks, getCustomerName } from '../../utils/status'

interface Props {
  job: JobDetail
  type1: Type1Payload
  markupPct?: number
}

export function ContextBanner({ job, type1, markupPct }: Props) {
  const item = type1.items[0]
  const tier = getTierFromTasks(job)
  const customer = getCustomerName(job)

  return (
    <div className="banner banner-blue">
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" />
      </svg>
      <div className="banner-content">
        <div className="banner-title">
          #RFQ-{job.id} · {customer}
        </div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4, fontSize: 13 }}>
          <span>Route: <strong>{item.origin} → {item.destination}</strong></span>
          <span>Mode: <strong>{item.mode}</strong></span>
          <span>Weight: <strong>{item.weight_kg} kg</strong></span>
          {tier !== '—' && <span>Tier: <strong>{tier}</strong></span>}
          {markupPct != null && <span>Markup: <strong>{markupPct}%</strong></span>}
        </div>
      </div>
    </div>
  )
}
