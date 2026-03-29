import { Badge } from '../ui/Badge'
import { getCarrierInitials, formatCurrency } from '../../utils/carrier'
import { formatDate } from '../../utils/time'
import type { Carrier } from '../../types/carrier'

interface Props {
  carrier: Carrier
  index: number
  selected: boolean
  isBestPrice: boolean
  onClick: () => void
}

export function CarrierCard({ carrier, selected, isBestPrice, onClick }: Props) {
  return (
    <div className={`carrier-card${selected ? ' selected' : ''}`} onClick={onClick}>
      <div className="carrier-select-ring">✓</div>
      <div className="carrier-header">
        <div className="carrier-avatar">{getCarrierInitials(carrier.carrier)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="carrier-name">{carrier.carrier}</div>
            {isBestPrice && <Badge variant="green" dot={false}>Best Price</Badge>}
            {carrier.transit_days != null && (
              <Badge variant="blue" dot={false}>{carrier.transit_days} day{carrier.transit_days !== 1 ? 's' : ''} transit</Badge>
            )}
          </div>
          <div className="carrier-meta">
            Transit: {carrier.transit_days != null ? `${carrier.transit_days} day(s)` : '—'}
            {' · '}Validity: {carrier.validity_date ? formatDate(carrier.validity_date) : '—'}
          </div>
        </div>
      </div>

      <div className="carrier-price-row">
        <div className="carrier-total">
          {carrier.currency_code} {carrier.grand_total.toLocaleString()}
        </div>
        <div className="carrier-currency">
          Base: {formatCurrency(carrier.subtotal_before_markup ?? carrier.subtotal, carrier.currency_code)}
        </div>
      </div>

      <div className="carrier-breakdown">
        {carrier.breakdown.map((line, i) => (
          <div key={i} style={{ display: 'contents' }}>
            <div className="line-label">{line.charge}</div>
            <div className="line-val">{carrier.currency_code} {line.amount.toLocaleString()}</div>
          </div>
        ))}
        <div className="line-total line-label" style={{ gridColumn: '1/2', paddingTop: 6 }}>Grand Total</div>
        <div className="line-total line-val" style={{ paddingTop: 6 }}>
          {carrier.currency_code} {carrier.grand_total.toLocaleString()}
        </div>
      </div>
    </div>
  )
}
