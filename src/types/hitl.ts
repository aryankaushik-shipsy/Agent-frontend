export type HitlInteractionType = 'form' | 'candidate_selection' | 'tool_args' | 'approval'

export interface FormFieldSchema {
  key: string        // dashboard-canonical name
  field?: string     // API sends "field" instead of "key"
  label: string
  type: 'string' | 'number' | 'date' | 'select' | 'text'
  editable: boolean
  options?: string[]
  description?: string | null
  min?: number | null
  max?: number | null
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

// tool_args intercept payload — the middleware only exposes the policy's
// editable arg keys; injected args (send_to, thread_id, etc.) are stripped out.
// We don't know the key names ahead of time — the policy decides them — so
// `args` is an open record and `ui_schema` supplies per-key presentation hints.
export interface ToolArgUiHint {
  label?: string
  description?: string
  format?: string          // e.g. "html", "markdown", "plain" — drives preview mode
  type?: string            // e.g. "string", "number"
  multiline?: boolean
}
export interface ToolArgsData {
  args: Record<string, unknown>
  ui_schema: Record<string, ToolArgUiHint>
}

export type ActionRoutingType = 'goto' | 'retrigger' | 'skip'
export type ActionStyle = 'primary' | 'danger' | 'secondary' | 'success' | string

// Per-action candidate-selection rules — only present on actions that operate on
// a candidate_selection step. `required=true` means the submit is blocked until
// the user picks a candidate. `editable_fields` lists keys the user is allowed
// to edit on the chosen candidate before submit; those edits go in `candidate_edits`.
export interface InterruptActionCandidates {
  required?: boolean
  editable_fields?: string[]
}

// One button defined by the policy engine. `id` is the action id sent back in the
// HITL action request; everything else controls how the dashboard presents it.
export interface InterruptActionItem {
  id: string
  label: string
  type?: ActionRoutingType
  style?: ActionStyle
  confirm_required?: boolean
  confirm_message?: string | null
  candidates?: InterruptActionCandidates | null
}

// Policy-driven constraints that shape dashboard affordances. Every field is
// optional — if it's not in the payload, the dashboard falls back to safe defaults.
export interface InterruptConstraints {
  // Note input
  note_label?: string | null
  note_max_length?: number | null
  require_note?: boolean
  // Retrigger budget
  retriggers_used?: number
  max_retrigger_attempts?: number
  // Timeout / auto-action
  timeout_at?: string | null
  timeout_seconds?: number | null
  timeout_action?: string | null        // e.g. "auto_approve"
  warn_before_seconds?: number | null
  // UI hints
  show_ai_recommendation?: boolean
}

export interface HITLInterruptPayload {
  interaction_type: HitlInteractionType[]
  step_index?: number | null
  step_name?: string
  total_steps?: number
  // Policy-authored header copy
  title?: string
  description?: string
  urgency?: string
  policy_id?: string
  data: {
    form?: FormData
    candidate_selection?: CandidateSelectionData
    tool_args?: ToolArgsData
  }
  // Prefer actions.items (policy engine shape). `actions` stays as a bare array
  // for backward compat with earlier payloads.
  actions?:
    | InterruptActionItem[]
    | { items: InterruptActionItem[]; source?: string }
  context?: {
    confidence_score?: number
    summary?: string
    recommendation?: string
    node_key?: string
    // Raw agent output — varies by node (may be a string or structured object)
    ai_response?: unknown
  }
  constraints?: InterruptConstraints
  // One entry per completed earlier step / retrigger. `new_value` and
  // `old_value` are records keyed by the field that was edited (may be null
  // when the step had no edits, e.g. a pure "select" action).
  prior_edits?: PriorEditEntry[] | null
}

export interface PriorEditEntry {
  job_id?: number
  hitl_id?: number
  action_id: string
  step_name: string
  step_index: number
  timestamp?: string
  new_value?: Record<string, unknown> | null
  old_value?: Record<string, unknown> | null
}

// Type discriminator — replaces the old HitlType = 1 | 2 | 3
export type HitlSubtype =
  | 'type1'       // interaction_type=["form"], step_index absent or 0
  | 'type2_step0' // interaction_type=["candidate_selection"]
  | 'type2_step1' // interaction_type=["form"], step_index == 1
  | 'type2_step2' // interaction_type=["form"], step_index == 2 — final approval
  | 'type3'       // interaction_type=["tool_args"]
