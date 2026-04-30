import { detectHitlSubtype, getPendingIntervention } from '../../utils/hitl'
import { Type1Card } from './Type1Card'
import { Type2Card } from './Type2Card'
import { Type3Card } from './Type3Card'
import { VendorRfqCard } from './VendorRfqCard'
import type { JobDetail } from '../../types/job'
import type { HITLActionRequest } from '../../api/hitl'

interface Props {
  job: JobDetail
  onAction: (interventionId: number, body: HITLActionRequest) => void
  loadingId: number | null
}

export function ApprovalCardRouter({ job, onAction, loadingId }: Props) {
  const pending = getPendingIntervention(job.interventions)
  if (!pending) return null

  const subtype = detectHitlSubtype(pending)
  const loading = loadingId === pending.id

  const handleAction = (body: HITLActionRequest) => onAction(pending.id, body)

  if (subtype === 'type1') {
    return (
      <Type1Card
        job={job}
        intervention={pending}
        onAction={handleAction}
        loading={loading}
      />
    )
  }

  if (subtype === 'type2_step0' || subtype === 'type2_step1' || subtype === 'type2_step2') {
    return (
      <Type2Card
        job={job}
        intervention={pending}
        subtype={subtype}
        onAction={handleAction}
        loading={loading}
      />
    )
  }

  if (subtype === 'type3') {
    return (
      <Type3Card
        job={job}
        intervention={pending}
        onAction={handleAction}
        loading={loading}
      />
    )
  }

  if (subtype === 'vendor_rfq') {
    return (
      <VendorRfqCard
        job={job}
        intervention={pending}
        onAction={handleAction}
        loading={loading}
      />
    )
  }

  return null
}
