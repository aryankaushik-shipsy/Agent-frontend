export interface BreakdownLine {
  label: string
  amount: number
}

export interface Carrier {
  carrier: string
  transit_days?: number
  validity_date?: string
  breakdown: BreakdownLine[]
  subtotal: number
  markup_pct: number
  markup_amount: number
  vat_pct?: number
  vat_amount?: number
  grand_total: number
  currency_code: string
}
