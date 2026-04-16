export type HitlInteractionType = 'form' | 'candidate_selection' | 'tool_args'

export interface FormFieldSchema {
  key: string
  label: string
  type: 'string' | 'number' | 'date' | 'select' | 'text'
  editable: boolean
  options?: string[]
}

export interface FormData {
  current_values: Record<string, unknown>
  schema: FormFieldSchema[]
  resolved_options: Record<string, string[]>
}

export interface CandidateOption {
  carrier: string
  transit_days: number | null
  validity_date: string | null
  subtotal_before_markup?: number
  subtotal: number
  markup_pct: number
  markup_amount: number
  vat_pct?: number
  vat_amount?: number
  grand_total: number
  currency_code: string
  breakdown: Array<{ charge: string; basis: string; unit_rate: number; units: number; amount: number }>
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

export interface CandidateSelectionData {
  id_field: string
  display_fields: string[]
  source_path: string
  options: CandidateOption[]
}

export interface ToolArgsData {
  args: { message: string; subject: string }
  ui_schema: Record<string, { description?: string; format?: string }>
}

export interface HITLInterruptPayload {
  interaction_type: HitlInteractionType[]
  step_index?: number | null
  total_steps?: number
  data: {
    form?: FormData
    candidate_selection?: CandidateSelectionData
    tool_args?: ToolArgsData
  }
  actions?: Array<{ id: string; label: string; type?: string; style?: string }>
  context?: {
    confidence_score?: number
    summary?: string
    recommendation?: string
    node_key?: string
  }
}

// Type discriminator — replaces the old HitlType = 1 | 2 | 3
export type HitlSubtype =
  | 'type1'       // interaction_type=["form"], step_index absent or 0
  | 'type2_step0' // interaction_type=["candidate_selection"]
  | 'type2_step1' // interaction_type=["form"], step_index == 1
  | 'type2_step2' // interaction_type=["form"], step_index == 2 — final approval
  | 'type3'       // interaction_type=["tool_args"]
