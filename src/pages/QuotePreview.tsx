import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useHitlAction } from '../hooks/useHitlAction'
import { getJobById } from '../api/jobs'
import { getPendingIntervention, detectHitlType } from '../utils/hitl'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import { expandToCanonicalBreakdown } from '../utils/charges'
import { formatDate } from '../utils/time'
import type { Carrier } from '../types/carrier'
import type { Type1Payload } from '../types/hitl'

interface PreviewState {
  actionId: string
  interventionId: number
  selectedCarrier: Carrier
  type1: Type1Payload
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
  const item = type1.items[0]

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
        if (pending && detectHitlType(pending) === 3) {
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
          <div style={{ fontWeight: 600, fontSize: 15 }}>Freight Quotation — {item.origin} → {item.destination}</div>
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
              <Row label="Origin" value={item.origin} />
              <Row label="Destination" value={item.destination} />
              <Row label="Mode" value={item.mode} />
              <Row label="Weight" value={`${item.weight_kg} kg`} />
              {(selectedCarrier.incoterm ?? selectedCarrier.incoterms ?? item.incoterms) && (
                <Row
                  label="Incoterm"
                  value={String(selectedCarrier.incoterm ?? selectedCarrier.incoterms ?? item.incoterms)}
                />
              )}
              {item.date && <Row label="Date" value={formatDate(item.date)} />}
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
            {expandToCanonicalBreakdown(selectedCarrier.breakdown).map((line, i) => {
              const sourceSuffix = line.rate_source === 'vendor' ? ' · Vendor'
                : line.rate_source === 'master' ? ' · Master'
                : ''
              return (
                <Row
                  key={i}
                  label={`${line.charge}${sourceSuffix}`}
                  value={`${selectedCarrier.currency_code} ${line.amount.toLocaleString()}`}
                  caption={line.note ?? undefined}
                  muted={!line.amount}
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
            {/* Discount section — only shown when customer sent a price cap */}
            {selectedCarrier.discount && (() => {
              const d = selectedCarrier.discount
              const base = selectedCarrier.subtotal_before_markup ?? selectedCarrier.subtotal
              const vatMultiplier = 1 + (selectedCarrier.vat_pct ?? 0) / 100
              // Strip VAT from the adjusted total before comparing against the pre-VAT cost base
              const adjustedPreVat = d.adjusted_grand_total / vatMultiplier
              const marginAtCap = adjustedPreVat - base
              const marginAtCapPct = base > 0 ? (marginAtCap / base) * 100 : 0
              return (
                <>
                  <Row
                    label="Original Total"
                    value={`${selectedCarrier.currency_code} ${d.original_grand_total.toLocaleString()}`}
                    strikethrough
                  />
                  <Row
                    label={`Discount (−${d.discount_pct.toFixed(1)}%)`}
                    value={`−${selectedCarrier.currency_code} ${d.discount_amount.toLocaleString()}`}
                    red
                  />
                  <Row
                    label={`Margin at Cap (${marginAtCapPct.toFixed(1)}%)`}
                    value={`${selectedCarrier.currency_code} ${marginAtCap.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    highlight
                  />
                </>
              )
            })()}
            {/* Grand total */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              marginTop: 12, paddingTop: 12, borderTop: '2px solid var(--gray-200)',
              fontWeight: 700, fontSize: 16,
            }}>
              <span>Grand Total</span>
              <span style={{ color: 'var(--primary, #1d4ed8)' }}>
                {selectedCarrier.currency_code} {(selectedCarrier.discount?.adjusted_grand_total ?? selectedCarrier.grand_total).toLocaleString()}
              </span>
            </div>

            {(() => {
              const exclusions = selectedCarrier.exclusions ?? selectedCarrier.excluded_charges
              if (!exclusions?.length) return null
              return (
                <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--gray-100)' }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Exclusions
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.6 }}>
                    {exclusions.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )
            })()}
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

function Row({ label, value, bold, highlight, strikethrough, red, caption, muted }: {
  label: string; value: string; bold?: boolean; highlight?: boolean; strikethrough?: boolean; red?: boolean; caption?: string; muted?: boolean
}) {
  return (
    <div style={{ padding: '5px 0', fontSize: 13, borderBottom: '1px solid var(--gray-50)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: red ? '#dc2626' : muted ? 'var(--gray-400)' : 'var(--gray-500)' }}>{label}</span>
        <span style={{
          fontWeight: bold ? 600 : 400,
          color: highlight ? 'var(--green-600, #16a34a)' : red ? '#dc2626' : (strikethrough || muted) ? 'var(--gray-400)' : undefined,
          textDecoration: strikethrough ? 'line-through' : undefined,
        }}>
          {value}
        </span>
      </div>
      {caption && (
        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2, fontStyle: 'italic' }}>{caption}</div>
      )}
    </div>
  )
}
