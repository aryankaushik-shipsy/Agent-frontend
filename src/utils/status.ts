import type { JobDetail, JobStatus, Task } from '../types/job'
import type { HitlSubtype } from '../types/hitl'
import { getFormData, getPendingIntervention } from './hitl'

export type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray'

export interface StatusResult {
  label: string
  variant: BadgeVariant
}

/** Returns true when the job was submitted via the platform form (not an inbound email). */
export function isPlatformJob(job: { input_json?: { type?: string } | null } | null | undefined): boolean {
  return job?.input_json?.type === 'Platform'
}

/**
 * Returns true when the job's quote email has been dispatched.
 *
 * Two signals, in priority order:
 *   1. The `send_email` task reached `success` / `completed` — the backend
 *      has fully processed the send. Authoritative.
 *   2. The Type-3 email-review intervention has `action_taken === 'approved'`
 *      AND the `generate_quotation` task completed beforehand. This covers
 *      the window between the reviewer clicking Send Email and the backend
 *      flipping `send_email.status` from `interrupted` → `success` — the
 *      email has been dispatched even though the task record hasn't caught
 *      up yet. The `generate_quotation` gate filters out intermediate
 *      clarification / apology emails, which also flow through Type 3.
 */
function isEmailSent(job: { tasks?: Task[]; interventions?: JobDetail['interventions'] }): boolean {
  const tasks = job.tasks ?? []

  // 1) send_email task has completed on the server
  const sendEmailDone = tasks.some(
    (t) => t.title?.toLowerCase() === 'send_email' && (t.status === 'success' || t.status === 'completed')
  )
  if (sendEmailDone) return true

  // 2) Type 3 approved AND quote already generated — the reviewer sent the
  //    final quote email; we're in the task-update lag window.
  const quoteGenerated = tasks.some(
    (t) => t.title === 'generate_quotation' && (t.status === 'success' || t.status === 'completed')
  )
  if (!quoteGenerated) return false
  return (job.interventions ?? []).some((i) => {
    const types = i.interrupt_message?.interaction_type ?? []
    return types.includes('tool_args') && i.action_taken === 'approved'
  })
}

export function isAwaitingAck(job: { status: string; tasks?: Task[]; interventions?: JobDetail['interventions'] }): boolean {
  if (job.status !== 'interrupted') return false
  return isEmailSent(job)
}

export function deriveJobStatus(
  status: JobStatus,
  subtype: HitlSubtype | null,
  tasks?: Task[],
  interventions?: JobDetail['interventions']
): StatusResult {
  if (status === 'queued') return { label: 'Queued', variant: 'gray' }
  if (status === 'success') return { label: 'Resolved', variant: 'green' }
  if (status === 'failed') return { label: 'Failed', variant: 'red' }
  if (status === 'interrupted') {
    if (isAwaitingAck({ status, tasks, interventions }))
      return { label: 'Quote Sent · Awaiting Ack', variant: 'blue' }
    const ratesDone = (tasks ?? []).some(
      (t) => t.title?.toLowerCase().includes('get_rate') &&
             (t.status === 'success' || t.status === 'completed')
    )
    if (!ratesDone) return { label: 'Gathering Info', variant: 'yellow' }
    if (subtype === 'type1') return { label: 'Awaiting Shipment Confirmation', variant: 'purple' }
    if (subtype === 'type2_step0') return { label: 'Carrier Selection Pending', variant: 'purple' }
    if (subtype === 'type2_step1') return { label: 'Price Review Pending', variant: 'purple' }
    if (subtype === 'type2_step2') return { label: 'Final Approval Pending', variant: 'purple' }
    if (subtype === 'type3') return { label: 'Email Review Pending', variant: 'purple' }
    return { label: 'Interrupted', variant: 'yellow' }
  }

  // running — check HITL subtype
  if (subtype === 'type1') return { label: 'Pending — Confirm Shipment', variant: 'purple' }
  if (subtype === 'type2_step0') return { label: 'Pending — Select Carrier', variant: 'yellow' }
  if (subtype === 'type2_step1') return { label: 'Pending — Review Pricing', variant: 'yellow' }
  if (subtype === 'type2_step2') return { label: 'Pending — Final Approval', variant: 'yellow' }
  if (subtype === 'type3') return { label: 'Pending — Email Preview', variant: 'yellow' }
  return { label: 'Processing', variant: 'blue' }
}

export function derivePipelineStage(job: JobDetail, subtype: HitlSubtype | null): StatusResult {
  if (job.status === 'queued') return { label: 'Queued', variant: 'gray' }
  if (job.status === 'success') return { label: 'Resolved', variant: 'green' }
  if (job.status === 'failed') return { label: 'Failed', variant: 'red' }

  // Forward-only pipeline: check from the most-advanced stage down to least-advanced.
  // The first matching condition wins — a job can never fall back to an earlier label.
  if (job.status === 'interrupted') {
    // Use getPendingIntervention so stale older records (newest intervention
    // has been acted on but an older Step 2 / Type 2 record is still
    // action_taken=null) don't keep "Price Negotiation" latched.
    const hasPending = getPendingIntervention(job.interventions) != null
    // Most advanced: quote was sent AND a new HITL has been triggered (price negotiation)
    if (isEmailSent(job) && hasPending) return { label: 'Price Negotiation', variant: 'yellow' }
    // Quote sent, no pending intervention — waiting on customer reply
    if (isEmailSent(job)) return { label: 'Quote Sent · Awaiting Ack', variant: 'blue' }
    // Pre-send HITL stages
    if (subtype === 'type3') return { label: 'Email Review Pending', variant: 'purple' }
    if (subtype === 'type2_step0') return { label: 'Carrier Selection Pending', variant: 'purple' }
    if (subtype === 'type2_step1') return { label: 'Price Review Pending', variant: 'purple' }
    if (subtype === 'type2_step2') return { label: 'Final Approval Pending', variant: 'purple' }
    if (subtype === 'type1') return { label: 'Awaiting Shipment Confirmation', variant: 'purple' }
    return { label: 'Gathering Info', variant: 'yellow' }
  }

  if (subtype === 'type1') return { label: 'Pending — Confirm Shipment', variant: 'purple' }
  if (subtype === 'type2_step0') return { label: 'Pending — Select Carrier', variant: 'yellow' }
  if (subtype === 'type2_step1') return { label: 'Pending — Review Pricing', variant: 'yellow' }
  if (subtype === 'type2_step2') return { label: 'Pending — Final Approval', variant: 'yellow' }
  if (subtype === 'type3') return { label: 'Pending — Email Preview', variant: 'yellow' }

  // running, no hitl — check currently running task title (forward order)
  const runningTask = job.tasks?.find((t) => t.status === 'running')
  const title = runningTask?.title?.toLowerCase() ?? ''
  if (title.includes('generate'))   return { label: 'Generating Email', variant: 'blue' }
  if (title.includes('calculate'))  return { label: 'Calculating Quote', variant: 'blue' }
  if (title.includes('get_rate'))   return { label: 'Fetching Rates', variant: 'blue' }
  if (title.includes('get_tier'))   return { label: 'Extracting Details', variant: 'blue' }

  return { label: 'Processing', variant: 'blue' }
}

export function getInfoField(
  info: Array<{ label: string; value: string }> | null | undefined,
  label: string
): string | null {
  return info?.find((f) => f.label.toLowerCase() === label.toLowerCase())?.value ?? null
}

/** Returns the Gmail thread / trace reference ID stored in job.info, if present. */
export function getTraceReference(
  job: { info?: Array<{ label: string; value: string }> | null } | null | undefined
): string | null {
  if (!job) return null
  return (
    getInfoField(job.info, 'Trace Reference') ??
    getInfoField(job.info, 'Thread ID') ??
    getInfoField(job.info, 'threadID') ??
    getInfoField(job.info, 'Reference') ??
    null
  )
}

type ShipmentRow = { origin?: string; destination?: string; mode?: string; weight_kg?: number; incoterms?: string; commodity?: string }

/**
 * Returns the authoritative shipment fields for display.
 *
 * Priority order — each source is a snapshot taken at a different point in
 * the workflow, and we want the latest one that reflects reviewer edits:
 *
 *   1. `calculate_final_price.results[0]` — post-edit values the pricing
 *      engine actually used. This is the most authoritative source once the
 *      agent has run rating.
 *   2. `get_rate.price_request_items[0]` — also post-edit; used before pricing
 *      runs (same schema as calculate_final_price carriers).
 *   3. Type 1 HITL `current_values` — frozen at extraction time. Correct
 *      only until the reviewer approves Type 1 with edits; after that it
 *      lags reality (the banner kept showing 100 kg while the carrier
 *      cards and downstream quote were priced at 250 kg).
 *   4. Input JSON row — last-ditch fallback.
 */
export function getShipmentFromHitl(job: JobDetail): ShipmentRow | null {
  const toRow = (src: Record<string, unknown> | undefined | null): ShipmentRow | null => {
    if (!src || typeof src !== 'object') return null
    return {
      origin: src.origin as string | undefined,
      destination: src.destination as string | undefined,
      mode: src.mode as string | undefined,
      weight_kg: src.weight_kg as number | undefined,
      incoterms: src.incoterms as string | undefined,
      commodity: src.commodity as string | undefined,
    }
  }

  // 1. calculate_final_price.results[0]
  const finalPrice = (job.tasks ?? []).find((t) => t.title === 'calculate_final_price')
  const finalRow = (finalPrice?.output_json as { results?: Array<Record<string, unknown>> } | undefined)?.results?.[0]
  const finalShipment = toRow(finalRow)
  if (finalShipment?.origin && finalShipment?.destination) return finalShipment

  // 2. get_rate.price_request_items[0]
  const rate = (job.tasks ?? []).find((t) => t.title === 'get_rate')
  const rateRow = (rate?.output_json as { price_request_items?: Array<Record<string, unknown>> } | undefined)?.price_request_items?.[0]
  const rateShipment = toRow(rateRow)
  if (rateShipment?.origin && rateShipment?.destination) return rateShipment

  // 3. Type 1 HITL current_values
  for (const intervention of job.interventions ?? []) {
    const msg = intervention.interrupt_message
    if (!msg) continue
    const type = msg.interaction_type?.[0]
    const stepIndex = msg.step_index
    if (type === 'form' && (stepIndex == null || stepIndex === 0)) {
      // Route through getFormData so V2 payloads (values on each leaf) are
      // synthesized into a flat current_values map the same way as V1.
      const form = getFormData(intervention)
      const cv = form?.current_values ?? msg.data?.form?.current_values
      if (cv) return toRow(cv)
    }
  }

  return null
}

export function getShipmentRow(job: { input_json?: { data?: unknown[] } | null }): ShipmentRow | null {
  const row = job?.input_json?.data?.[0]
  if (!row || typeof row !== 'object') return null
  return row as ShipmentRow
}

export function getCustomerName(
  job: {
    info?: Array<{ label: string; value: string }>
    input_json?: { company_name?: string; sender_email?: string } | null
  } | null | undefined
): string {
  if (!job) return '—'
  // Primary: job.info labeled fields (platform-processed)
  const fromInfo =
    getInfoField(job.info, 'Customer') ??
    getInfoField(job.info, 'Company Name') ??
    getInfoField(job.info, 'Sender Email')
  if (fromInfo) return fromInfo
  // Fallback: raw input_json fields
  return job.input_json?.company_name || job.input_json?.sender_email || '—'
}

const TIER_DISPLAY: Record<string, string> = {
  gold: 'Gold',
  silver: 'Silver',
  base: 'Bronze',
  bronze: 'Bronze',
}

export function getTierFromTasks(job: JobDetail): string {
  const tierTask = job.tasks?.find((t) => t.title?.toLowerCase().includes('get_tier'))
  if (!tierTask?.output_json) return '—'
  const out = tierTask.output_json as Record<string, unknown>
  const raw = (out.tier as string) ?? ''
  return TIER_DISPLAY[raw.toLowerCase()] ?? raw ?? '—'
}

export interface TierInfo {
  tierLabel: string        // "Bronze" / "Silver" / "Gold"
  tierRaw: string          // "base" / "silver" / "gold"
  preferredCurrency: string // "AED"
  currencyRate: number     // rate from USD e.g. 3.67
  currencyName: string     // "UAE Dirham"
}

export function getTierInfo(job: JobDetail): TierInfo | null {
  const tierTask = job.tasks?.find((t) => t.title?.toLowerCase().includes('get_tier'))
  if (!tierTask?.output_json) return null
  const out = tierTask.output_json as Record<string, unknown>
  const raw = (out.tier as string) ?? ''
  const currInfo = out.currency_info as { name?: string; rate_from_usd?: number } | undefined
  return {
    tierRaw: raw,
    tierLabel: TIER_DISPLAY[raw.toLowerCase()] ?? raw ?? '—',
    preferredCurrency: (out.preferred_currency as string) ?? 'USD',
    currencyRate: currInfo?.rate_from_usd ?? 1,
    currencyName: currInfo?.name ?? '',
  }
}
