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

  // V2: look for a candidate_picker leaf anywhere in the form tree
  const form = msg.data?.form
  if (form && isV2Schema(form.schema)) {
    const picker = flattenLeaves(form.schema as FormSection[]).find(isCandidatePicker) as CandidatePickerLeaf | undefined
    if (!picker) return null
    return {
      id_field: picker.id_field,
      display_fields: picker.display_fields,
      source_path: '',
      // Cast to the legacy CandidateOption shape — downstream code reads
      // fields dynamically so a loose Record[] is safe here.
      options: picker.options as unknown as CandidateSelectionData['options'],
    }
  }
  return null
}

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

export function getPendingIntervention(interventions: Intervention[] | undefined): Intervention | undefined {
  return interventions?.find((i) => i.action_taken == null && i.status !== 'completed')
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
