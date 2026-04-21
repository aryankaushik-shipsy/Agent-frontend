import type { Intervention } from '../types/job'
import type {
  HitlSubtype,
  FormData,
  CandidateSelectionData,
  ToolArgsData,
  InterruptActionItem,
  FormSection,
  FormGroup,
  FormLeaf,
  CandidatePickerLeaf,
  NoteLeaf,
  FormTreeNode,
  FormFieldSchema,
} from '../types/hitl'
import { isFormGroup, isCandidatePicker, isNoteLeaf, isFormLeaf } from '../types/hitl'
import { formatDate } from './time'

// -----------------------------------------------------------------------------
// V2 schema detection & traversal
//
// The backend moved every interaction type (form / tool_args / candidate_selection
// / free_text) onto a single `data.form.schema: Section[]` tree. A Section has
// a `title` plus a `schema` array of Leaf | Group. Leaves carry `type`; groups
// don't. Candidate-picker and note leaves are special-cased on submit.
// -----------------------------------------------------------------------------

type V2Node = FormSection | FormGroup | FormLeaf | CandidatePickerLeaf | NoteLeaf

function isV2Schema(schema: unknown): schema is FormSection[] {
  if (!Array.isArray(schema) || schema.length === 0) return false
  const first = schema[0] as Record<string, unknown>
  // Sections always have `schema` (array) and a `title`, and no `type` / `field`.
  return Array.isArray(first?.schema) && typeof first?.title === 'string' && !('type' in first) && !('field' in first)
}

/** Walk a Section / Group / Leaf tree and yield every leaf in order. */
export function flattenLeaves(sections: FormSection[]): Array<FormLeaf | CandidatePickerLeaf | NoteLeaf> {
  const out: Array<FormLeaf | CandidatePickerLeaf | NoteLeaf> = []
  function visit(node: V2Node) {
    // Sections and groups both have a `schema` array of children
    if ('schema' in node && Array.isArray(node.schema)) {
      for (const child of node.schema) visit(child as V2Node)
      return
    }
    out.push(node as FormLeaf | CandidatePickerLeaf | NoteLeaf)
  }
  for (const section of sections) visit(section)
  return out
}

/** Visit tree, returning ONLY regular form leaves (skipping candidate_picker + note). */
export function flattenFormLeaves(sections: FormSection[]): FormLeaf[] {
  return flattenLeaves(sections).filter(isFormLeaf) as FormLeaf[]
}

// -----------------------------------------------------------------------------
// Subtype discriminator — kept so existing cards keep working unchanged.
// -----------------------------------------------------------------------------

export function detectHitlSubtype(intervention: Intervention): HitlSubtype | null {
  const msg = intervention.interrupt_message
  if (!msg) return null
  const types = msg.interaction_type ?? []
  const has = (t: string) => types.includes(t as never)

  // Tool-args intercept — Type 3 email review
  if (has('tool_args')) return 'type3'

  // Candidate selection → always Step 0 of Type 2
  if (has('candidate_selection')) return 'type2_step0'

  // Pure approval → Type 2 Step 2 (final decision)
  if (has('approval') && !has('form')) return 'type2_step2'

  // Plain form — distinguish by step_index. Type 2 multi-step uses the same
  // hitl_id and bumps step_index; Type 1 is single-step.
  if (has('form')) {
    if (msg.step_index == null || msg.step_index === 0) return 'type1'
    if (msg.step_index === 2) return 'type2_step2'
    return 'type2_step1'
  }
  return null
}

// -----------------------------------------------------------------------------
// Extractors — adapt V2 payload back into the old flat-schema shape that the
// existing card components consume. The `sections` / `candidate_picker` /
// `note_leaf` extras on FormData give cards that want the richer tree a way
// to opt in without rewriting everything.
// -----------------------------------------------------------------------------

/** Convert a V2 FormLeaf into the legacy FormFieldSchema shape. */
function leafToFieldSchema(leaf: FormLeaf): FormFieldSchema {
  return {
    key: leaf.name,
    field: leaf.name,
    label: leaf.label,
    type: leaf.type,
    editable: !leaf.disabled,
    disabled: leaf.disabled === true,
    options: leaf.options ?? null,
    description: leaf.description ?? null,
    min: leaf.validation?.min ?? null,
    max: leaf.validation?.max ?? null,
    step: leaf.validation?.step ?? null,
    format: leaf.format ?? null,
    language: leaf.language ?? null,
    true_label: leaf.true_label ?? null,
    false_label: leaf.false_label ?? null,
    max_selections: leaf.max_selections ?? null,
    options_source_path: leaf.options_source_path ?? null,
    required: leaf.required === true,
  }
}

export function getFormData(intervention: Intervention): FormData | null {
  const raw = intervention.interrupt_message?.data?.form
  if (!raw) return null

  // V2: form.schema is Section[] with nested leaves/groups
  if (isV2Schema(raw.schema)) {
    const sections = raw.schema as FormSection[]
    const allLeaves = flattenLeaves(sections)
    const formLeaves = allLeaves.filter(isFormLeaf) as FormLeaf[]
    const candidatePicker = allLeaves.find(isCandidatePicker) as CandidatePickerLeaf | undefined
    const noteLeaf = allLeaves.find(isNoteLeaf) as NoteLeaf | undefined

    // Build the flat FormFieldSchema[] the existing cards consume.
    const schema = formLeaves.map(leafToFieldSchema)

    // Build current_values from each leaf's inline `value`. Include the picker's
    // value too so the UI can prefill selection if the server already chose one.
    const current_values: Record<string, unknown> = {}
    for (const leaf of allLeaves) {
      current_values[leaf.name] = leaf.value
    }

    return {
      schema,
      current_values,
      resolved_options: {},
      sections,
      candidate_picker: candidatePicker ?? null,
      note_leaf: noteLeaf ?? null,
    }
  }

  // V1 fallback — legacy flat schema. The API used to send `field` instead
  // of `key` on each entry; normalize that here.
  const schema = (raw.schema ?? []).map((s) => ({
    ...s,
    key: s.key || (s as unknown as Record<string, string>).field || '',
  }))
  return {
    ...raw,
    schema,
  } as FormData
}

export function getCandidateData(intervention: Intervention): CandidateSelectionData | null {
  const msg = intervention.interrupt_message
  if (!msg) return null

  // V1 kept candidates under data.candidate_selection
  const v1 = msg.data?.candidate_selection
  if (v1) return v1

  // V2a/V2b: look for a candidate/candidate_picker leaf in the form tree.
  const form = msg.data?.form
  if (form && isV2Schema(form.schema)) {
    const picker = flattenLeaves(form.schema as FormSection[]).find(isCandidatePicker) as CandidatePickerLeaf | undefined
    if (!picker) return null

    // Prefer V2b fields; synthesize display_fields from option_schema sub-leaves
    // so downstream code that still reads display_fields / options keeps working.
    const cards = (picker.data ?? picker.options ?? []) as Array<Record<string, unknown>>
    let displayFields = picker.display_fields
    if (!displayFields && picker.option_schema) {
      displayFields = picker.option_schema
        .filter((n): n is FormLeaf => 'type' in n)
        .map((l) => l.name)
    }
    return {
      id_field: picker.id_field,
      display_fields: displayFields ?? [],
      source_path: '',
      options: cards as unknown as CandidateSelectionData['options'],
    }
  }
  return null
}

/**
 * Surface the full candidate leaf (V2b-shaped) so callers that want to render
 * cards via `option_schema` can do so. Returns `null` for pure-V1 / V2a
 * payloads — those callers should use `getCandidateData` + `display_fields`.
 */
export function getCandidateLeaf(intervention: Intervention): CandidatePickerLeaf | null {
  const form = intervention.interrupt_message?.data?.form
  if (!form || !isV2Schema(form.schema)) return null
  const picker = flattenLeaves(form.schema as FormSection[]).find(isCandidatePicker) as CandidatePickerLeaf | undefined
  return picker ?? null
}

// send_email tool injects these args at runtime (send_to from the customer's
// email, thread_id / message_id for reply threading, type for template
// dispatch). They're not reviewer-editable — the policy guide §2.2.5 /
// build_tool_args_form calls them out explicitly. Backends SHOULD filter
// them before the form leaves the server; until that's rock-solid this
// client-side allowlist is a belt-and-braces defense.
const TOOL_ARG_INJECTED_KEYS = new Set(['send_to', 'thread_id', 'message_id', 'type'])

export function getToolArgsData(intervention: Intervention): ToolArgsData | null {
  const msg = intervention.interrupt_message
  if (!msg) return null

  // V1 shape: data.tool_args.args + ui_schema — render surface.
  const v1 = msg.data?.tool_args
  if (v1 && 'args' in v1) return v1 as ToolArgsData

  // V2: tool_args UI is regular form leaves under data.form.schema. The
  // `data.tool_args` block is server-only metadata and must not be rendered.
  // Adapt: pull the tool args into an `args` record from the form leaves so
  // legacy Type3 card consumers still work.
  const form = msg.data?.form
  if (form && isV2Schema(form.schema)) {
    const leaves = flattenFormLeaves(form.schema as FormSection[])
      // Drop the well-known injected args — reviewers don't control these.
      .filter((l) => !TOOL_ARG_INJECTED_KEYS.has(l.name))
    if (leaves.length === 0) return null
    const args: Record<string, unknown> = {}
    const ui_schema: Record<string, { label?: string; description?: string; format?: string; multiline?: boolean }> = {}
    for (const leaf of leaves) {
      args[leaf.name] = leaf.value
      ui_schema[leaf.name] = {
        label: leaf.label,
        description: leaf.description ?? undefined,
        format: leaf.format ?? undefined,
        multiline: leaf.type === 'textarea' || leaf.format === 'textarea' || leaf.format === 'markdown',
      }
    }
    return { args, ui_schema }
  }
  return null
}

/**
 * Quick content-based check for "does this string look like HTML?".
 *
 * Not bulletproof — a plain sentence with "<3" wouldn't trip it — but good
 * enough to catch email bodies and policy-declared HTML fields when the
 * backend omits the `format=html` hint. Callers should prefer the schema
 * hint and only fall back to this when the hint is absent.
 */
export function looksLikeHtml(value: unknown): boolean {
  if (typeof value !== 'string') return false
  return /<(?:p|div|span|br|h[1-6]|table|tr|td|th|tbody|thead|ul|ol|li|a|strong|em|b|i|img|hr|blockquote|code|pre)\b[^>]*>/i.test(value)
}

export function getPendingIntervention(interventions: Intervention[] | undefined): Intervention | undefined {
  if (!interventions || interventions.length === 0) return undefined

  // Sort newest-first by created_at. The newest intervention is the
  // authoritative current step — older action_taken=null records can
  // linger when the backend advances the workflow without closing an
  // earlier multi-step policy record (rare, but we've seen jobs where
  // a stale Type-2 Step-2 stays action_taken=null while a later Type-3
  // email has already fired AND been approved).
  const sorted = [...interventions].sort((a, b) => {
    const at = a.created_at ? new Date(a.created_at).getTime() : 0
    const bt = b.created_at ? new Date(b.created_at).getTime() : 0
    return bt - at
  })

  // If the newest intervention has been acted on (or marked completed),
  // nothing is pending — treat any older null records as stale.
  const newest = sorted[0]
  if (newest.action_taken != null || newest.status === 'completed') {
    return undefined
  }
  return newest
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

/** Prettify a snake_case key as a label — used when ui_schema/schema doesn't give us one. */
export function humanizeKey(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Render a candidate / form value for display based on field-name heuristics
 * plus any currency code present on the owning object. Keeps the dashboard
 * policy-agnostic — the payload drives which fields exist, this only decides
 * how to present them when we don't have explicit schema hints.
 */
export function formatFieldValue(key: string, value: unknown, owner?: Record<string, unknown>): string {
  if (value == null || value === '') return '—'
  // Date-ish
  if (key.endsWith('_date') || key === 'date' || key === 'validity_date') {
    return formatDate(String(value))
  }
  // Percent-ish
  if (key.endsWith('_pct')) return `${Number(value)}%`
  // Money-ish — prefix with owner's currency_code when present
  if (
    key === 'grand_total' ||
    key === 'subtotal' ||
    key === 'subtotal_before_markup' ||
    key.endsWith('_amount') ||
    key.endsWith('_total')
  ) {
    const num = Number(value)
    if (!Number.isFinite(num)) return String(value)
    const ccy = owner && typeof owner.currency_code === 'string' ? owner.currency_code : null
    return ccy ? `${ccy} ${num.toLocaleString()}` : num.toLocaleString()
  }
  // Numbers — thousands separator, no currency
  if (typeof value === 'number') return value.toLocaleString()
  return String(value)
}

/**
 * Returns the action items array from an intervention, handling both shapes:
 * - V2: `actions: [...]` (flat array — current server contract)
 * - Legacy: `actions: { items: [...], source: "..." }`
 */
export function getActionItems(intervention: Intervention | null | undefined): InterruptActionItem[] {
  const raw = intervention?.interrupt_message?.actions
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  return raw.items ?? []
}

// Re-export tree helpers so cards / renderer can import from one place.
export { isFormGroup, isCandidatePicker, isNoteLeaf, isFormLeaf }
