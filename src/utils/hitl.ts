import type { Intervention } from '../types/job'
import type { HitlSubtype, FormData, CandidateSelectionData, ToolArgsData, InterruptActionItem } from '../types/hitl'

export function detectHitlSubtype(intervention: Intervention): HitlSubtype | null {
  const msg = intervention.interrupt_message
  if (!msg) return null
  const type = msg.interaction_type?.[0]
  if (type === 'candidate_selection') return 'type2_step0'
  if (type === 'tool_args') return 'type3'
  if (type === 'approval') return 'type2_step2'
  if (type === 'form') {
    if (msg.step_index == null || msg.step_index === 0) return 'type1'
    if (msg.step_index === 2) return 'type2_step2'
    return 'type2_step1'
  }
  return null
}

export function getFormData(intervention: Intervention): FormData | null {
  const raw = intervention.interrupt_message?.data?.form
  if (!raw) return null
  // Normalize: API sends "field" instead of "key" in schema entries
  const schema = (raw.schema ?? []).map((s) => ({
    ...s,
    key: s.key || (s as unknown as Record<string, string>).field || '',
  }))
  return { ...raw, schema }
}

export function getCandidateData(intervention: Intervention): CandidateSelectionData | null {
  return intervention.interrupt_message?.data?.candidate_selection ?? null
}

export function getToolArgsData(intervention: Intervention): ToolArgsData | null {
  return intervention.interrupt_message?.data?.tool_args ?? null
}

export function getPendingIntervention(interventions: Intervention[] | undefined): Intervention | undefined {
  return interventions?.find((i) => i.action_taken == null && i.status !== 'completed')
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}

/**
 * Returns the action items array from an intervention, handling both shapes:
 * - Legacy: `actions: [...]`
 * - Policy engine: `actions: { items: [...], source: "..." }`
 */
export function getActionItems(intervention: Intervention | null | undefined): InterruptActionItem[] {
  const raw = intervention?.interrupt_message?.actions
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  return raw.items ?? []
}
