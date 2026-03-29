import type { Intervention } from '../types/job'
import type { HitlType } from '../types/hitl'

function resolveAiResponse(raw: string | Record<string, unknown>): Record<string, unknown> | string | null {
  // Already a parsed object — use directly
  if (typeof raw === 'object' && raw !== null) return raw
  // String — try JSON.parse; return string on failure (Type 3 HTML)
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return raw // raw HTML string
    }
  }
  return null
}

export function parseAiResponse<T>(intervention: Intervention): T | null {
  const resolved = resolveAiResponse(intervention.interrupt.details.ai_response)
  if (resolved === null || typeof resolved === 'string') return null
  return resolved as T
}

export function detectHitlType(intervention: Intervention): HitlType | null {
  const resolved = resolveAiResponse(intervention.interrupt.details.ai_response)
  if (resolved === null) return null
  // String that failed JSON.parse → raw HTML → Type 3
  if (typeof resolved === 'string') return 3
  if ('items' in resolved) return 1
  if ('carriers' in resolved) return 2
  return null
}

export function getPendingIntervention(interventions: Intervention[] | undefined): Intervention | undefined {
  // "pending" = action_taken is null (API has no status field on interventions)
  return interventions?.find((i) => i.action_taken == null)
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim()
}
