import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useHitlAction } from '../hooks/useHitlAction'
import { Button } from '../components/ui/Button'
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

  async function handleSend() {
    await mutateAsync({ id: interventionId, action: actionId })
    navigate('/pipeline')
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
              {item.date && <Row label="Date" value={formatDate(item.date)} />}
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
          Send Quote
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
