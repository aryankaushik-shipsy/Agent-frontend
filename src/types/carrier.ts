export interface BreakdownLine {
  charge: string
  basis?: string
  unit_rate?: number | null
  units?: number | null
  amount: number
  // Origin of the rate — "master" (rate-card lookup) vs "vendor" (RFQ response).
  // Rendered as a muted suffix on the line label when present.
  rate_source?: 'master' | 'vendor' | null
  // Per-line caption (e.g. DDP duty note on Customs Clearance — Dest.).
  // Frontend renders verbatim; never authored client-side.
  note?: string | null
}

export interface Carrier {
  carrier: string
  transit_days?: number | null
  validity_date?: string | null
  // Quote validity expressed in days (preferred over validity_date when both
  // are present; vendor-sourced quotes use a shorter window).
  validity_days?: number | null
  // Incoterm propagated onto the quote — drives the chip on quote views and
  // the "Quote Basis" line. The value comes from the policy payload.
  incoterm?: string | null
  // Free-form basis line (e.g. "EXW Dubai, UAE") shown beneath the carrier.
  quote_basis?: string | null
  // Policy-authored exclusions copy. Rendered as a bulleted list on the
  // quote preview / sidebar when non-empty.
  exclusions?: string[] | null
  breakdown: BreakdownLine[]
  subtotal_before_markup?: number
  subtotal: number
  markup_pct: number
  markup_amount: number
  vat_pct?: number
  vat_amount?: number
  grand_total: number
  currency_code: string
  // Populated when calculate_final_price is called with a customer price cap
  discount?: {
    customer_cap: number
    is_profitable: boolean
    discount_amount: number
    discount_pct: number
    profit_at_cap_pct: number
    adjusted_grand_total: number
    original_grand_total: number
  } | null
}
