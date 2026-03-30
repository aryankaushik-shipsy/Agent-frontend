import { Badge } from '../ui/Badge'
import { getCarrierInitials, formatCurrency } from '../../utils/carrier'
import { formatDate } from '../../utils/time'
import type { Carrier } from '../../types/carrier'

interface Props {
  carrier: Carrier
  index: number
  selected: boolean
  isBestPrice: boolean
  isBestMargin: boolean
  tierLabel?: string
  onClick: () => void
}

export function CarrierCard({ carrier, selected, isBestPrice, isBestMargin, tierLabel, onClick }: Props) {
  const base = carrier.subtotal_before_markup ?? carrier.subtotal
  const hasMarkup = carrier.markup_pct != null && carrier.markup_amount != null

  return (
    <div className={`carrier-card${selected ? ' selected' : ''}`} onClick={onClick}>
      <div className="carrier-select-ring">✓</div>
      <div className="carrier-header">
        <div className="carrier-avatar">{getCarrierInitials(carrier.carrier)}</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div className="carrier-name">{carrier.carrier}</div>
            {isBestPrice  && <Badge variant="green"  dot={false}>Best Price</Badge>}
            {isBestMargin && <Badge variant="purple" dot={false}>Best Margin</Badge>}
            {tierLabel    && <Badge variant="blue"   dot={false}>{tierLabel} Tier</Badge>}
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
          {carrier.currency_code} {carrier.grand_total?.toLocaleString() ?? '—'}
        </div>
        <div className="carrier-currency">
          {base != null ? `Base: ${formatCurrency(base, carrier.currency_code)}` : ''}
        </div>
      </div>

      {/* Markup / margin row */}
      {hasMarkup && (
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--gray-600)', padding: '4px 0 8px' }}>
          <span>Markup: <strong>{carrier.markup_pct}%</strong></span>
          <span>Margin: <strong>{formatCurrency(carrier.markup_amount!, carrier.currency_code)}</strong></span>
          {carrier.vat_pct != null && (
            <span>VAT ({carrier.vat_pct}%): <strong>{formatCurrency(carrier.vat_amount ?? 0, carrier.currency_code)}</strong></span>
          )}
        </div>
      )}

      <div className="carrier-breakdown">
        {(carrier.breakdown ?? []).map((line, i) => (
          <div key={i} style={{ display: 'contents' }}>
            <div className="line-label">{line.charge}</div>
            <div className="line-val">{carrier.currency_code} {line.amount.toLocaleString()}</div>
          </div>
        ))}
        <div className="line-total line-label" style={{ gridColumn: '1/2', paddingTop: 6 }}>Grand Total</div>
        <div className="line-total line-val" style={{ paddingTop: 6 }}>
          {carrier.currency_code} {carrier.grand_total?.toLocaleString() ?? '—'}
        </div>
      </div>
    </div>
  )
}
