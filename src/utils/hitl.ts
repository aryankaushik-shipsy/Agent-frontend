import type { Intervention } from '../types/job'
import type { HitlType } from '../types/hitl'

export function parseAiResponse<T>(intervention: Intervention): T | null {
  try {
    return JSON.parse(intervention.interrupt.details.ai_response) as T
  } catch {
    return null
  }
}

export function detectHitlType(intervention: Intervention): HitlType | null {
  // Type 3: actions contain send_email
  if (intervention.interrupt.actions.some((a) => a.id === 'send_email')) {
    return 3
  }

  // Parse ai_response to check for Type 1 or 2
  const parsed = parseAiResponse<Record<string, unknown>>(intervention)
  if (!parsed) return null

  if ('items' in parsed) return 1
  if ('carriers' in parsed) return 2

  return null
}

export function getPendingIntervention(interventions: Intervention[]): Intervention | undefined {
  return interventions.find((i) => i.status === 'pending')
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}
