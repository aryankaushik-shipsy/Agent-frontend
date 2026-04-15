import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useHitlAction } from '../hooks/useHitlAction'
import { getJobById } from '../api/jobs'
import { getPendingIntervention, detectHitlSubtype } from '../utils/hitl'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { formatDate } from '../utils/time'
import type { Carrier } from '../types/carrier'
import type { FormData } from '../types/hitl'

interface PreviewState {
  actionId: string
  interventionId: number
  selectedCarrier: Carrier
  type1: FormData
  tier: string
  customer: string
}

export function QuotePreview() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { mutateAsync, isPending } = useHitlAction()
  const [waitingForPreview, setWaitingForPreview] = useState(false)
  const [waitingTimedOut, setWaitingTimedOut] = useState(false)

  const state = location.state as PreviewState | null

  if (!state?.selectedCarrier) {
    return (
      <div className="banner banner-yellow">
        <div className="banner-content">
          No carrier selected. <button onClick={() => navigate(-1)} style={{ textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>Go back</button>
        </div>
      </div>
    )
  }

  const { actionId, interventionId, selectedCarrier, type1, tier, customer } = state
  const cv = type1.current_values

  if (waitingForPreview) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 16 }}>
        <Spinner size="lg" />
        <div style={{ fontWeight: 600, fontSize: 16 }}>Generating email preview…</div>
        <div style={{ color: 'var(--gray-500)', fontSize: 13, textAlign: 'center', maxWidth: 340 }}>
          The agent is preparing your quote email. This usually takes 20–30 seconds.
        </div>
      </div>
    )
  }

  if (waitingTimedOut) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 16 }}>
        <div style={{ fontSize: 32 }}>⏱</div>
        <div style={{ fontWeight: 600, fontSize: 16 }}>Taking longer than expected</div>
        <div style={{ color: 'var(--gray-500)', fontSize: 13, textAlign: 'center', maxWidth: 340 }}>
          The email preview hasn't appeared yet. Check HITL Approvals — it may arrive shortly.
        </div>
        <Button variant="primary" onClick={() => navigate('/approvals')}>
          Go to HITL Approvals
        </Button>
      </div>
    )
  }

  async function handleSend() {
    await mutateAsync({ id: interventionId, action: actionId })
    setWaitingForPreview(true)

    // Poll for the new Type 3 (email preview) HITL entry the agent will create.
    // Max ~45 s (15 attempts × 3 s each).
    const jobIdNum = parseInt(jobId!)
    let attempts = 0
    const MAX = 15

    const poll = async () => {
      attempts++
      try {
        const job = await getJobById(jobIdNum)
        const pending = getPendingIntervention(job.interventions)
        if (pending && detectHitlSubtype(pending) === 'type3') {
          navigate(`/pipeline/${jobIdNum}/email-preview`)
          return
        }
      } catch {
        // network hiccup — keep trying
      }
      if (attempts < MAX) {
        setTimeout(poll, 3_000)
      } else {
        setWaitingForPreview(false)
        setWaitingTimedOut(true)
      }
    }

    setTimeout(poll, 2_000) // brief initial delay so the backend can process
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            background: 'none', border: '1px solid var(--gray-200)', borderRadius: 6,
            padding: '6px 12px', cursor: 'pointer', fontSize: 13, color: 'var(--gray-600)',
          }}
        >
          ← Back
        </button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Quote Preview</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            #RFQ-{jobId} · Review before sending
          </div>
        </div>
      </div>

      {/* Preview card */}
      <div className="card card-body" style={{ padding: 0, overflow: 'hidden' }}>

        {/* Email-style header band */}
        <div style={{ background: 'var(--gray-50)', borderBottom: '1px solid var(--gray-100)', padding: '20px 24px' }}>
          <div style={{ fontSize: 11, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>
            Quote Email Preview
          </div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>Freight Quotation — {String(cv.origin ?? '—')} → {String(cv.destination ?? '—')}</div>
          <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>To: {customer}</div>
        </div>

        <div style={{ padding: '24px' }}>
          {/* Two-column: Customer + Shipment */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
            <section>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Customer
              </div>
              <Row label="Name" value={customer} />
              <Row label="Tier" value={tier} />
            </section>
            <section>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Shipment
              </div>
              <Row label="Origin" value={String(cv.origin ?? '—')} />
              <Row label="Destination" value={String(cv.destination ?? '—')} />
              <Row label="Mode" value={String(cv.mode ?? '—')} />
              <Row label="Weight" value={cv.weight_kg != null ? `${cv.weight_kg} kg` : '—'} />
              {cv.date != null && <Row label="Date" value={formatDate(String(cv.date))} />}
            </section>
          </div>

          <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Selected Carrier &amp; Pricing
            </div>
            <Row label="Carrier" value={selectedCarrier.carrier} bold />
            {selectedCarrier.validity_date && (
              <Row label="Quote Valid Until" value={formatDate(selectedCarrier.validity_date)} />
            )}
            {(selectedCarrier.breakdown ?? []).map((line, i) => (
              <Row key={i} label={line.charge} value={`${selectedCarrier.currency_code} ${line.amount.toLocaleString()}`} />
            ))}
            {selectedCarrier.markup_pct != null && (
              <Row label="Markup" value={`${selectedCarrier.markup_pct}%`} />
            )}
            {selectedCarrier.markup_amount != null && (
              <Row label="Margin Earned" value={`${selectedCarrier.currency_code} ${selectedCarrier.markup_amount.toLocaleString()}`} highlight />
            )}
            {selectedCarrier.vat_amount != null && (
              <Row
                label={`VAT${selectedCarrier.vat_pct != null ? ` (${selectedCarrier.vat_pct}%)` : ''}`}
                value={`${selectedCarrier.currency_code} ${selectedCarrier.vat_amount.toLocaleString()}`}
              />
            )}
            {/* Grand total */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 12, paddingTop: 12, borderTop: '2px solid var(--gray-200)',
              fontWeight: 700, fontSize: 16,
            }}>
              <span>Grand Total</span>
              <span style={{ color: 'var(--primary, #1d4ed8)' }}>
                {selectedCarrier.currency_code} {selectedCarrier.grand_total.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
        <Button variant="ghost" onClick={() => navigate(-1)} disabled={isPending}>
          ← Change Carrier
        </Button>
        <Button variant="green" loading={isPending} onClick={handleSend}>
          Confirm Carrier
        </Button>
      </div>
    </div>
  )
}

function Row({ label, value, bold, highlight }: { label: string; value: string; bold?: boolean; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 13, borderBottom: '1px solid var(--gray-50)' }}>
      <span style={{ color: 'var(--gray-500)' }}>{label}</span>
      <span style={{ fontWeight: bold ? 600 : 400, color: highlight ? 'var(--green-600, #16a34a)' : undefined }}>
        {value}
      </span>
    </div>
  )
}
