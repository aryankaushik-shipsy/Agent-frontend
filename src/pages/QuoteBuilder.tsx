import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useJob } from '../hooks/useJob'
import { useHitlAction } from '../hooks/useHitlAction'
import { getFormData, getCandidateData, getPendingIntervention } from '../utils/hitl'
import { getTierFromTasks } from '../utils/status'
import { findBestPriceIndex, findBestMarginIndex, getCarriersFromTask } from '../utils/carrier'
import { getTierInfo } from '../utils/status'
import { ContextBanner } from '../components/quote-builder/ContextBanner'
import { CarrierCard } from '../components/quote-builder/CarrierCard'
import { MarginValidation } from '../components/quote-builder/MarginValidation'
import { AIRecommendation } from '../components/quote-builder/AIRecommendation'
import { QuoteSummarySidebar } from '../components/quote-builder/QuoteSummarySidebar'
import { Spinner } from '../components/ui/Spinner'
import type { FormData } from '../types/hitl'

export function QuoteBuilder() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { data: job, isLoading } = useJob(jobId ? parseInt(jobId) : null)
  const { mutateAsync, isPending } = useHitlAction()
  const [selectedIdx, setSelectedIdx] = useState(0)

  if (isLoading) {
    return <div style={{ padding: 40, textAlign: 'center' }}><Spinner size="lg" /></div>
  }
  if (!job) {
    return <div style={{ padding: 40 }}>Job not found.</div>
  }

  // Find Type 1 intervention (shipment form, step_index absent or 0)
  const type1Int = (job.interventions ?? []).find((i) => {
    const msg = i.interrupt_message
    return msg?.interaction_type?.[0] === 'form' && (msg.step_index == null || msg.step_index === 0)
  })
  const type1: FormData | null = type1Int ? getFormData(type1Int) : null

  // Pending intervention (Type 2 carrier selection)
  const type2Int = getPendingIntervention(job.interventions)
  const candidateData = type2Int ? getCandidateData(type2Int) : null

  if (!type1 || !type2Int) {
    return (
      <div className="banner banner-yellow">
        <div className="banner-content">This job is not in Carrier Selection stage.</div>
      </div>
    )
  }

  // Prefer full carrier data from calculate_final_price task (has breakdown, markup, subtotal).
  // Fall back to candidate_selection options from HITL payload.
  const taskCarriers = getCarriersFromTask(job)
  const carriers = taskCarriers.length > 0
    ? taskCarriers
    : (candidateData?.options ?? [])
  const bestIdx = findBestPriceIndex(carriers)
  const bestMarginIdx = findBestMarginIndex(carriers)
  const selectedCarrier = carriers[selectedIdx]
  const tierInfo = getTierInfo(job)
  const tier = tierInfo?.tierLabel ?? getTierFromTasks(job)

  async function handleAction(action: string) {
    if (!type2Int) return
    await mutateAsync({ id: type2Int.id, action })
    navigate('/pipeline')
  }

  return (
    <div>
      <ContextBanner job={job} type1={type1} markupPct={selectedCarrier?.markup_pct} />

      <div className="quote-layout">
        <div>
          {carriers.map((carrier, i) => (
            <CarrierCard
              key={i}
              carrier={carrier}
              index={i}
              selected={selectedIdx === i}
              isBestPrice={i === bestIdx}
              isBestMargin={i === bestMarginIdx}
              tierLabel={tierInfo?.tierLabel}
              onClick={() => setSelectedIdx(i)}
            />
          ))}

          <MarginValidation carrier={selectedCarrier} tier={tier} />
          <AIRecommendation text={type2Int.interrupt_message?.context?.recommendation ?? type2Int.interrupt?.recommendation} />
        </div>

        <QuoteSummarySidebar
          job={job}
          type1={type1}
          selectedCarrier={selectedCarrier}
          selectedIndex={selectedIdx}
          interventionId={type2Int.id}
          onConfirm={handleAction}
          onReject={() => handleAction('end')}
          loading={isPending}
        />
      </div>
    </div>
  )
}
