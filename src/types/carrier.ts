export interface BreakdownLine {
  charge: string
  basis?: string
  unit_rate?: number | null
  units?: number | null
  amount: number
}

export interface Carrier {
  carrier: string
  transit_days?: number | null
  validity_date?: string | null
  breakdown: BreakdownLine[]
  subtotal_before_markup?: number
  subtotal: number
  markup_pct: number
  markup_amount: number
  vat_pct?: number
  vat_amount?: number
  grand_total: number
  currency_code: string
}
