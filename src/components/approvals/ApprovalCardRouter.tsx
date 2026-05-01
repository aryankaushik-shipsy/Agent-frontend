import { detectHitlType, getPendingIntervention, parseAiResponse } from '../../utils/hitl'
import { Type1Card } from './Type1Card'
import { Type2Card } from './Type2Card'
import { Type3Card } from './Type3Card'
import { VendorRfqCard } from './VendorRfqCard'
import { NoRatesDecisionCard } from './NoRatesDecisionCard'
import type { JobDetail } from '../../types/job'
import type { Type1Payload, Type2Payload, Type4Payload, Type5Payload } from '../../types/hitl'

interface Props {
  job: JobDetail
  onAction: (interventionId: number, action: string) => void
  loadingId: number | null
}

export function ApprovalCardRouter({ job, onAction, loadingId }: Props) {
  const pending = getPendingIntervention(job.interventions)
  if (!pending) return null

  const hitlType = detectHitlType(pending)
  const loading = loadingId === pending.id

  if (hitlType === 1) {
    const payload = parseAiResponse<Type1Payload>(pending)
    if (!payload) return null
    return (
      <Type1Card
        job={job}
        intervention={pending}
        payload={payload}
        onAction={(action) => onAction(pending.id, action)}
        loading={loading}
      />
    )
  }

  if (hitlType === 2) {
    const payload = parseAiResponse<Type2Payload>(pending)
    if (!payload) return null
    return (
      <Type2Card
        job={job}
        intervention={pending}
        payload={payload}
        onAction={(action) => onAction(pending.id, action)}
        loading={loading}
      />
    )
  }

  if (hitlType === 3) {
    return (
      <Type3Card
        job={job}
        intervention={pending}
        onAction={(action) => onAction(pending.id, action)}
        loading={loading}
      />
    )
  }

  if (hitlType === 4) {
    const payload = parseAiResponse<Type4Payload>(pending) ?? { vendors: [] }
    return (
      <VendorRfqCard
        job={job}
        intervention={pending}
        payload={payload}
        onAction={(action) => onAction(pending.id, action)}
        loading={loading}
      />
    )
  }

  if (hitlType === 5) {
    const payload = parseAiResponse<Type5Payload>(pending)
    if (!payload) return null
    return (
      <NoRatesDecisionCard
        job={job}
        intervention={pending}
        payload={payload}
        onAction={(action) => onAction(pending.id, action)}
        loading={loading}
      />
    )
  }

  return null
}
