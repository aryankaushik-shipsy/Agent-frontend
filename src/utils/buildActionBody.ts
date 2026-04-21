import type { HITLActionRequest } from '../api/hitl'
import type {
  FormSection,
  FormLeaf,
  InterruptActionItem,
  CandidatePickerLeaf,
  NoteLeaf,
} from '../types/hitl'
import { flattenLeaves, isCandidatePicker, isNoteLeaf, isFormLeaf } from './hitl'

/**
 * Inputs a reviewer provides in the card UI, keyed by leaf.name.
 *
 * - For regular form leaves: the current (possibly-edited) value.
 * - For the candidate_picker leaf: the selected candidate's id_field value,
 *   plus optional per-field edits on the selected card in `candidateEdits`.
 * - For the note leaf: the free-text string.
 *
 * Original values come from the payload — the body only includes fields that
 * actually changed (edited_values shrinks to just the diff).
 */
export interface BuildBodyInputs {
  sections: FormSection[]
  values: Record<string, unknown>
  candidateEdits?: Record<string, unknown>
  note?: string
  clickedAction: InterruptActionItem
}

/**
 * Walk the V2 form tree and pack the user's inputs into the canonical
 * HITLActionRequest body per the routing table in policy_and_api_guide.md §3.2:
 *
 *   FormLeaf           → edited_values[leaf.name]  (only when changed)
 *   CandidatePickerLeaf → selected_candidate_id + candidate_edits
 *   NoteLeaf            → instruction (if action.type === 'retrigger')
 *                       → data.free_text_input (otherwise)
 *   reviewer note input → note (top-level; constraints.require_note controls)
 *
 * `candidate_edits` is gated on the clicked action declaring
 * `candidates.editable_fields`; keys outside that allowlist are dropped
 * server-side so we only include declared keys to avoid noise.
 */
export function buildActionBody({
  sections,
  values,
  candidateEdits,
  note,
  clickedAction,
}: BuildBodyInputs): HITLActionRequest {
  const body: HITLActionRequest = { action: clickedAction.id }

  const leaves = flattenLeaves(sections)
  const edited_values: Record<string, unknown> = {}
  let selectedCandidateId: string | undefined
  let noteValue: string | undefined

  for (const leaf of leaves) {
    if (leaf.disabled) continue

    if (isCandidatePicker(leaf)) {
      const picker = leaf as CandidatePickerLeaf
      const current = values[picker.name]
      if (current != null && current !== '') selectedCandidateId = String(current)
      continue
    }

    if (isNoteLeaf(leaf)) {
      const nl = leaf as NoteLeaf
      const v = values[nl.name]
      if (typeof v === 'string' && v.trim()) noteValue = v.trim()
      continue
    }

    if (isFormLeaf(leaf)) {
      const fl = leaf as FormLeaf
      const current = values[fl.name]
      // Only diff: include if user changed it. Deep-equality is overkill
      // here — arrays/objects we treat as changed unless strictly equal.
      if (current !== fl.value) edited_values[fl.name] = current
    }
  }

  if (Object.keys(edited_values).length > 0) body.edited_values = edited_values

  if (selectedCandidateId) body.selected_candidate_id = selectedCandidateId

  // candidate_edits: V2b drops per-action editable_fields — editability is
  // now per-sub-leaf on the candidate leaf's option_schema (each sub-leaf
  // carries its own `disabled` flag). We trust the caller only populated
  // non-disabled sub-leaf edits. For V2a payloads where the action still
  // has editable_fields, respect that allowlist as a safety net.
  if (candidateEdits && Object.keys(candidateEdits).length > 0) {
    const editableFields = clickedAction.candidates?.editable_fields
    if (editableFields && editableFields.length > 0) {
      const allowed: Record<string, unknown> = {}
      for (const k of editableFields) {
        if (k in candidateEdits) allowed[k] = candidateEdits[k]
      }
      if (Object.keys(allowed).length > 0) body.candidate_edits = allowed
    } else {
      body.candidate_edits = candidateEdits
    }
  }

  const trimmedNote = note?.trim()
  if (trimmedNote) body.note = trimmedNote

  // NoteLeaf value routes based on action type
  if (noteValue) {
    if (clickedAction.type === 'retrigger') {
      body.instruction = noteValue
    } else {
      body.data = { ...(body.data ?? {}), free_text_input: noteValue }
    }
  }

  return body
}
