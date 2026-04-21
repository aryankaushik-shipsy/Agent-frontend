export type HitlInteractionType = 'form' | 'candidate_selection' | 'tool_args' | 'approval' | 'free_text'

// Legacy names (string/date/datetime/boolean) are kept for backward compat
// with pre-refactor payloads. V2 policy backend emits the unified-schema names:
// text / textarea / email / number / select / multiselect / radio / checkbox /
// switch / datepicker / timepicker.
export type FormFieldType =
  | 'string'          // legacy → renders as text
  | 'text'
  | 'textarea'
  | 'email'
  | 'number'
  | 'date'            // legacy → datepicker
  | 'datetime'        // legacy → datepicker with HH:mm format
  | 'datepicker'
  | 'timepicker'
  | 'boolean'         // legacy → switch
  | 'switch'
  | 'checkbox'
  | 'radio'
  | 'select'
  | 'multiselect'

// A select/multiselect option — the backend may send either a bare string or
// an object with explicit display label + submit value.
export type SelectOption = string | { label: string; value: string }

// Policy-authored per-field schema. The dashboard renders widgets based on
// `type` + optional `format`/`language` hints. Only `key`/`label`/`type` are
// guaranteed — everything else is optional and falls back to safe defaults.
export interface FormFieldSchema {
  key: string        // dashboard-canonical name
  field?: string     // API sends "field" instead of "key"
  label: string
  type: FormFieldType
  editable: boolean
  options?: SelectOption[] | null
  description?: string | null
  // Numeric constraints
  min?: number | null
  max?: number | null
  step?: number | null
  // Format hint — drives sub-rendering for datepicker (date vs datetime via
  // "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm") and textarea (markdown / code / html).
  format?: string | null
  language?: string | null        // for format=code (e.g. "json")
  // Boolean / switch labels for true/false states
  true_label?: string | null
  false_label?: string | null
  // multiselect cap
  max_selections?: number | null
  // Dynamic options — resolved server-side and surfaced in `resolved_options`,
  // but some payloads still include the source path for reference.
  options_source_path?: string | null
  source_path?: string
  required?: boolean
  // Unified-schema refactor sends this alongside `editable: false`.
  disabled?: boolean
}

export interface FormData {
  current_values: Record<string, unknown>
  schema: FormFieldSchema[]
  resolved_options: Record<string, SelectOption[]>
  // V2 unified schema — when present, the original `Section[]` tree from the
  // policy payload. Cards that need group headings / nested groups read from
  // here; older cards keep reading the flattened `schema` above.
  sections?: FormSection[]
  // The CandidatePickerLeaf (if any) — split out so cards can render a card
  // grid instead of a generic widget.
  candidate_picker?: CandidatePickerLeaf | null
  // The NoteLeaf (if any) — when present, its value routes to `instruction`
  // (retrigger) or `data.free_text_input` (else) on submit, NOT to edited_values.
  note_leaf?: NoteLeaf | null
}

// =============================================================================
// V2 unified form schema — data.form.schema = Section[]
// Mirrors the contract in sdd/hitl/policy_and_api_guide.md §2.1.
// =============================================================================
export interface FormSection {
  title: string
  schema: Array<FormLeaf | FormGroup | CandidatePickerLeaf | NoteLeaf>
}

export interface FormGroup {
  name: string
  title: string
  schema: Array<FormLeaf | FormGroup | CandidatePickerLeaf | NoteLeaf>
}

// A "regular" editable form field whose value goes into `edited_values[name]`.
export interface FormLeaf {
  type: FormFieldType
  name: string
  label: string
  value: unknown
  required?: boolean
  disabled?: boolean
  placeholder?: string
  description?: string | null
  validation?: {
    min?: number
    max?: number
    step?: number
    minLength?: number
    maxLength?: number
    pattern?: string
  }
  options?: SelectOption[] | null
  options_source_path?: string | null
  format?: string | null
  language?: string | null
  true_label?: string | null
  false_label?: string | null
  max_selections?: number | null
}

// Candidate-picker leaf — one per step when interaction_type includes
// "candidate_selection". Selection routes to `selected_candidate_id`;
// per-field inline edits on the selected card → `candidate_edits`.
export interface CandidatePickerLeaf {
  type: 'candidate_picker'
  name: string
  label: string
  value: unknown
  required?: boolean
  disabled?: boolean
  options: Array<Record<string, unknown>>
  id_field: string
  display_fields: string[]
}

// Free-text note leaf — value routes to `instruction` (retrigger actions)
// or `data.free_text_input` (any other action type).
export interface NoteLeaf {
  type: 'note'
  name: string
  label: string
  value: unknown
  required?: boolean
  disabled?: boolean
  placeholder?: string
}

// Discriminator helpers. Per the policy guide render algorithm, a node is a
// group iff it has NO `type` key (leaves always carry `type`).
export type FormTreeNode = FormLeaf | FormGroup | CandidatePickerLeaf | NoteLeaf
export function isFormGroup(node: FormTreeNode): node is FormGroup {
  return !('type' in node)
}
export function isCandidatePicker(node: FormTreeNode): node is CandidatePickerLeaf {
  return 'type' in node && node.type === 'candidate_picker'
}
export function isNoteLeaf(node: FormTreeNode): node is NoteLeaf {
  return 'type' in node && node.type === 'note'
}
export function isFormLeaf(node: FormTreeNode): node is FormLeaf {
  return 'type' in node && node.type !== 'candidate_picker' && node.type !== 'note'
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

// V2 (current contract): one entry per edited field, with a single
// primitive old/new pair and a `field` name.
// V1 (legacy): one entry per step, with action_id / step_name and a
// record-shaped old_value / new_value keyed by field name.
// The union supports both; renderers should prefer `field` when present.
export interface PriorEditEntry {
  step_index: number
  // V2 per-field entry
  field?: string
  // V1 per-step entry
  action_id?: string
  step_name?: string
  timestamp?: string
  job_id?: number
  hitl_id?: number
  // V2 carries primitives here; V1 carries Record<string, unknown>
  new_value?: unknown
  old_value?: unknown
}

// Type discriminator — replaces the old HitlType = 1 | 2 | 3
export type HitlSubtype =
  | 'type1'       // interaction_type=["form"], step_index absent or 0
  | 'type2_step0' // interaction_type=["candidate_selection"]
  | 'type2_step1' // interaction_type=["form"], step_index == 1
  | 'type2_step2' // interaction_type=["form"], step_index == 2 — final approval
  | 'type3'       // interaction_type=["tool_args"]
