import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useJob } from '../hooks/useJob'
import { useHitlAction } from '../hooks/useHitlAction'
import { parseAiResponse, getPendingIntervention } from '../utils/hitl'
import { getTierFromTasks } from '../utils/status'
import { findBestPriceIndex } from '../utils/carrier'
import { ContextBanner } from '../components/quote-builder/ContextBanner'
import { CarrierCard } from '../components/quote-builder/CarrierCard'
import { MarginValidation } from '../components/quote-builder/MarginValidation'
import { AIRecommendation } from '../components/quote-builder/AIRecommendation'
import { QuoteSummarySidebar } from '../components/quote-builder/QuoteSummarySidebar'
import { Spinner } from '../components/ui/Spinner'
import type { Type1Payload, Type2Payload } from '../types/hitl'

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

  // Find interventions
  const type1Int = (job.interventions ?? []).find((i) => {
    const p = parseAiResponse<Record<string, unknown>>(i)
    return p && 'items' in p
  })
  const type2Int = getPendingIntervention(job.interventions)
  const type1 = type1Int ? parseAiResponse<Type1Payload>(type1Int) : null
  const type2 = type2Int ? parseAiResponse<Type2Payload>(type2Int) : null

  if (!type1 || !type2 || !type2Int) {
    return (
      <div className="banner banner-yellow">
        <div className="banner-content">This job is not in Carrier Selection stage.</div>
      </div>
    )
  }

  const carriers = type2.carriers
  const bestIdx = findBestPriceIndex(carriers)
  const selectedCarrier = carriers[selectedIdx]
  const tier = getTierFromTasks(job)

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
              onClick={() => setSelectedIdx(i)}
            />
          ))}

          <MarginValidation carrier={selectedCarrier} tier={tier} />
          <AIRecommendation text={type2Int.interrupt.recommendation} />
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
