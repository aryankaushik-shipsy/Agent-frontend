import { Badge } from '../ui/Badge'
import { getCarrierInitials, formatCurrency } from '../../utils/carrier'
import { formatDate } from '../../utils/time'
import { expandToCanonicalBreakdown } from '../../utils/charges'
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
  const discount = carrier.discount ?? null
  // Prefer validity_days when supplied (vendor-sourced rates often use 7d).
  // Fall back to the absolute validity_date.
  const validityLabel = carrier.validity_days != null
    ? `${carrier.validity_days} day${carrier.validity_days !== 1 ? 's' : ''}`
    : carrier.validity_date ? formatDate(carrier.validity_date) : '—'

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
            {discount     && <Badge variant="yellow" dot={false}>Discounted</Badge>}
            {carrier.incoterm && <Badge variant="gray" dot={false}>{carrier.incoterm}</Badge>}
            {carrier.transit_days != null && (
              <Badge variant="blue" dot={false}>{carrier.transit_days} day{carrier.transit_days !== 1 ? 's' : ''} transit</Badge>
            )}
          </div>
          <div className="carrier-meta">
            Transit: {carrier.transit_days != null ? `${carrier.transit_days} day(s)` : '—'}
            {' · '}Validity: {validityLabel}
          </div>
          {carrier.quote_basis && (
            <div className="carrier-meta" style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 2 }}>
              Quote Basis: {carrier.quote_basis}
            </div>
          )}
        </div>
      </div>

      <div className="carrier-price-row">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          {discount ? (
            <>
              <div className="carrier-total">
                {carrier.currency_code} {discount.adjusted_grand_total.toLocaleString()}
              </div>
              <div style={{ fontSize: 14, color: 'var(--gray-400)', textDecoration: 'line-through' }}>
                {carrier.currency_code} {discount.original_grand_total.toLocaleString()}
              </div>
            </>
          ) : (
            <div className="carrier-total">
              {carrier.currency_code} {carrier.grand_total?.toLocaleString() ?? '—'}
            </div>
          )}
        </div>
        <div className="carrier-currency">
          {base != null ? `Base: ${formatCurrency(base, carrier.currency_code)}` : ''}
        </div>
      </div>

      {discount && (
        <div style={{ fontSize: 12, color: '#dc2626', padding: '2px 0 6px', fontWeight: 500 }}>
          Discount applied: −{discount.discount_pct.toFixed(1)}% ({carrier.currency_code} {discount.discount_amount.toLocaleString()}) · Cap: {carrier.currency_code} {discount.customer_cap.toLocaleString()}
        </div>
      )}

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
        {expandToCanonicalBreakdown(carrier.breakdown).map((line, i) => {
          const sourceLabel = line.rate_source === 'vendor' ? 'Vendor'
            : line.rate_source === 'master' ? 'Master'
            : null
          const isZero = !line.amount
          return (
            <div key={i} style={{ display: 'contents' }}>
              <div className="line-label" style={isZero ? { color: 'var(--gray-400)' } : undefined}>
                {line.charge}
                {sourceLabel && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--gray-400)', fontWeight: 400 }}>
                    · {sourceLabel}
                  </span>
                )}
                {line.note && (
                  <div style={{ fontSize: 11, color: 'var(--gray-500)', fontWeight: 400, marginTop: 2 }}>
                    {line.note}
                  </div>
                )}
              </div>
              <div className="line-val" style={isZero ? { color: 'var(--gray-400)' } : undefined}>
                {carrier.currency_code} {line.amount.toLocaleString()}
              </div>
            </div>
          )
        })}
        <div className="line-total line-label" style={{ gridColumn: '1/2', paddingTop: 6 }}>Grand Total</div>
        <div className="line-total line-val" style={{ paddingTop: 6 }}>
          {discount ? (
            <span>
              <span style={{ textDecoration: 'line-through', color: 'var(--gray-400)', marginRight: 6, fontWeight: 400 }}>
                {carrier.currency_code} {discount.original_grand_total.toLocaleString()}
              </span>
              {carrier.currency_code} {discount.adjusted_grand_total.toLocaleString()}
            </span>
          ) : (
            `${carrier.currency_code} ${carrier.grand_total?.toLocaleString() ?? '—'}`
          )}
        </div>
      </div>
    </div>
  )
}
