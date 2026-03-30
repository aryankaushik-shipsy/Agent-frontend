import { useNavigate } from 'react-router-dom'
import { Button } from '../ui/Button'
import { formatDate } from '../../utils/time'
import { getTierFromTasks, getCustomerName } from '../../utils/status'
import type { JobDetail } from '../../types/job'
import type { Carrier } from '../../types/carrier'
import type { Type1Payload } from '../../types/hitl'

interface Props {
  job: JobDetail
  type1: Type1Payload
  selectedCarrier: Carrier | undefined
  selectedIndex: number
  interventionId: number
  onConfirm: (action: string) => void
  onReject: () => void
  loading: boolean
}

export function QuoteSummarySidebar({
  job, type1, selectedCarrier, selectedIndex,
  interventionId, onConfirm, onReject, loading
}: Props) {
  const navigate = useNavigate()
  const item = type1.items[0]
  const tier = getTierFromTasks(job)
  const customer = getCustomerName(job)
  const actionId = `carrier_${selectedIndex + 1}`

  function handleChooseCarrier() {
    navigate(`/pipeline/${job.id}/quote/preview`, {
      state: { actionId, interventionId, selectedCarrier, type1, tier, customer },
    })
  }

  return (
    <div className="quote-summary-card">
      <div className="qs-title">Quote Summary</div>

      <div className="qs-row">
        <span className="qs-label">RFQ Reference</span>
        <span className="qs-val">#RFQ-{job.id}</span>
      </div>
      <div className="qs-row">
        <span className="qs-label">Customer</span>
        <span className="qs-val" style={{ maxWidth: 160, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{customer}</span>
      </div>
      <div className="qs-row">
        <span className="qs-label">Tier</span>
        <span className="qs-val">{tier}</span>
      </div>
      <div className="qs-row">
        <span className="qs-label">Origin</span>
        <span className="qs-val">{item.origin}</span>
      </div>
      <div className="qs-row">
        <span className="qs-label">Destination</span>
        <span className="qs-val">{item.destination}</span>
      </div>
      <div className="qs-row">
        <span className="qs-label">Mode</span>
        <span className="qs-val">{item.mode}</span>
      </div>
      <div className="qs-row">
        <span className="qs-label">Chargeable Weight</span>
        <span className="qs-val">{item.weight_kg} kg</span>
      </div>

      {selectedCarrier && (
        <>
          <div className="qs-row">
            <span className="qs-label">Carrier</span>
            <span className="qs-val">{selectedCarrier.carrier}</span>
          </div>
          <div className="qs-row">
            <span className="qs-label">Validity</span>
            <span className="qs-val">
              {selectedCarrier.validity_date ? formatDate(selectedCarrier.validity_date) : '—'}
            </span>
          </div>
          {selectedCarrier.markup_pct != null && (
            <div className="qs-row">
              <span className="qs-label">Markup</span>
              <span className="qs-val">{selectedCarrier.markup_pct}%</span>
            </div>
          )}
          {selectedCarrier.markup_amount != null && (
            <div className="qs-row">
              <span className="qs-label">Margin earned</span>
              <span className="qs-val" style={{ color: 'var(--green-600, #16a34a)', fontWeight: 600 }}>
                {selectedCarrier.currency_code} {selectedCarrier.markup_amount.toLocaleString()}
              </span>
            </div>
          )}
          {selectedCarrier.vat_amount != null && (
            <div className="qs-row">
              <span className="qs-label">VAT {selectedCarrier.vat_pct != null ? `(${selectedCarrier.vat_pct}%)` : ''}</span>
              <span className="qs-val">{selectedCarrier.currency_code} {selectedCarrier.vat_amount.toLocaleString()}</span>
            </div>
          )}
          <div className="qs-total">
            <span>Grand Total</span>
            <span>{selectedCarrier.currency_code} {selectedCarrier.grand_total.toLocaleString()}</span>
          </div>
        </>
      )}

      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Button
          variant="primary"
          disabled={!selectedCarrier}
          onClick={handleChooseCarrier}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Choose Carrier →
        </Button>
        <Button
          variant="red-outline"
          disabled={loading}
          onClick={onReject}
          style={{ width: '100%', justifyContent: 'center' }}
        >
          Reject Quote
        </Button>
      </div>
    </div>
  )
}
