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
  selectedCandidateId: string
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

  const { actionId, interventionId, selectedCarrier, selectedCandidateId, type1, tier, customer } = state
  const cv = type1.current_values ?? {}

  if (waitingForPreview) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 320, gap: 16 }}>
        <Spinner size="lg" />
        <div style={{ fontWeight: 600, fontSize: 16 }}>Processing selection…</div>
        <div style={{ color: 'var(--gray-500)', fontSize: 13, textAlign: 'center', maxWidth: 340 }}>
          The agent is advancing to the next step. This usually takes a few seconds.
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
          The next step hasn't appeared yet. Check the pipeline — it may arrive shortly.
        </div>
        <Button variant="primary" onClick={() => navigate('/pipeline')}>
          Go to Pipeline
        </Button>
      </div>
    )
  }

  async function handleSend() {
    await mutateAsync({ id: interventionId, action: actionId, selected_candidate_id: selectedCandidateId })
    setWaitingForPreview(true)

    // Poll the same HITL record for step advancement.
    // After Step 0 is submitted the middleware resets action_taken to null,
    // increments current_step, and updates the interrupt payload.
    const jobIdNum = parseInt(jobId!)
    let attempts = 0
    const MAX = 15

    const poll = async () => {
      attempts++
      try {
        const job = await getJobById(jobIdNum)
        const pending = getPendingIntervention(job.interventions)
        if (!pending) { /* not ready yet */ }
        else {
          const subtype = detectHitlSubtype(pending)
          // Step 1 — price edit form
          if (subtype === 'type2_step1') {
            navigate(`/pipeline/${jobIdNum}/quote/edit`)
            return
          }
          // Step 2 — final approval
          if (subtype === 'type2_step2') {
            navigate(`/pipeline/${jobIdNum}/quote/confirm`)
            return
          }
          // Separate Type 3 — email preview (different HITL record)
          if (subtype === 'type3') {
            navigate(`/pipeline/${jobIdNum}/email-preview`)
            return
          }
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
              {(selectedCarrier.incoterm ?? cv.incoterms) != null && (
                <Row label="Incoterm" value={String(selectedCarrier.incoterm ?? cv.incoterms)} />
              )}
              {cv.date != null && <Row label="Date" value={formatDate(String(cv.date))} />}
            </section>
          </div>

          <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Selected Carrier &amp; Pricing
            </div>
            <Row label="Carrier" value={selectedCarrier.carrier} bold />
            {selectedCarrier.quote_basis && (
              <Row label="Quote Basis" value={selectedCarrier.quote_basis} />
            )}
            {selectedCarrier.transit_days != null && (
              <Row label="Transit" value={`${selectedCarrier.transit_days} day${selectedCarrier.transit_days !== 1 ? 's' : ''}`} />
            )}
            {selectedCarrier.validity_days != null ? (
              <Row label="Validity" value={`${selectedCarrier.validity_days} day${selectedCarrier.validity_days !== 1 ? 's' : ''}`} />
            ) : selectedCarrier.validity_date ? (
              <Row label="Quote Valid Until" value={formatDate(selectedCarrier.validity_date)} />
            ) : null}
            {(selectedCarrier.breakdown ?? []).map((line, i) => {
              const sourceSuffix = line.rate_source === 'vendor' ? ' · Vendor'
                : line.rate_source === 'master' ? ' · Master'
                : ''
              return (
                <Row
                  key={i}
                  label={`${line.charge}${sourceSuffix}`}
                  value={`${selectedCarrier.currency_code} ${line.amount.toLocaleString()}`}
                  caption={line.note ?? undefined}
                />
              )
            })}
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

            {(selectedCarrier.exclusions?.length ?? 0) > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--gray-100)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Exclusions
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.6 }}>
                  {selectedCarrier.exclusions!.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
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

function Row({ label, value, bold, highlight, caption }: { label: string; value: string; bold?: boolean; highlight?: boolean; caption?: string }) {
  return (
    <div style={{ padding: '5px 0', fontSize: 13, borderBottom: '1px solid var(--gray-50)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--gray-500)' }}>{label}</span>
        <span style={{ fontWeight: bold ? 600 : 400, color: highlight ? 'var(--green-600, #16a34a)' : undefined }}>
          {value}
        </span>
      </div>
      {caption && (
        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2, fontStyle: 'italic' }}>{caption}</div>
      )}
    </div>
  )
}
