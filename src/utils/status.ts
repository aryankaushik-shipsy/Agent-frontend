import type { JobDetail, JobStatus, Task } from '../types/job'
import type { HitlType } from '../types/hitl'

export type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray'

export interface StatusResult {
  label: string
  variant: BadgeVariant
}

// Task title that confirms the final quote email has been dispatched and the job
// is now waiting for customer acknowledgement. send_email is intentionally excluded
// as it fires at intermediate steps too and would produce false positives.
const QUOTE_SENT_TASK_KEYS = ['carrier_1', 'carrier_2']

/**
 * Returns true when a job is `interrupted` but the quote email has already been
 * dispatched — indicated by a completed task matching QUOTE_SENT_TASK_KEYS.
 * The job will stay interrupted until the customer responds, so we need this
 * separate check to avoid labelling it as a blocked/error state.
 */
/** Returns true when the job was submitted via the platform form (not an inbound email). */
export function isPlatformJob(job: { input_json?: { type?: string } | null } | null | undefined): boolean {
  return job?.input_json?.type === 'Platform'
}

/** Returns true when the send-email task has completed, regardless of job type. */
function isEmailSent(tasks: Task[] | undefined): boolean {
  return (tasks ?? []).some(
    (t) =>
      QUOTE_SENT_TASK_KEYS.some((key) => t.title?.toLowerCase().includes(key)) &&
      (t.status === 'success' || t.status === 'completed')
  )
}

export function isAwaitingAck(job: { status: string; tasks?: Task[]; input_json?: { type?: string } | null }): boolean {
  if (job.status !== 'interrupted') return false
  // Platform-initiated jobs have no customer email thread — no ack stage
  if (isPlatformJob(job)) return false
  return isEmailSent(job.tasks)
}

export function deriveJobStatus(
  status: JobStatus,
  hitlType: HitlType | null,
  tasks?: Task[]
): StatusResult {
  if (status === 'queued') return { label: 'Queued', variant: 'gray' }
  if (status === 'success') return { label: 'Quote Accepted', variant: 'green' }
  if (status === 'failed') return { label: 'Failed', variant: 'red' }
  if (status === 'interrupted') {
    if (isAwaitingAck({ status, tasks }))
      return { label: 'Quote Sent · Awaiting Ack', variant: 'blue' }
    const ratesDone = (tasks ?? []).some(
      (t) => t.title?.toLowerCase().includes('get_rate') &&
             (t.status === 'success' || t.status === 'completed')
    )
    if (!ratesDone) return { label: 'Gathering Info', variant: 'yellow' }
    if (hitlType === 1) return { label: 'Awaiting Shipment Confirmation', variant: 'purple' }
    if (hitlType === 2) return { label: 'Carrier Selection Pending', variant: 'purple' }
    if (hitlType === 3) return { label: 'Email Review Pending', variant: 'purple' }
    return { label: 'Interrupted', variant: 'yellow' }
  }

  // running — check HITL type
  if (hitlType === 1) return { label: 'Pending — Confirm Shipment', variant: 'purple' }
  if (hitlType === 2) return { label: 'Pending — Select Carrier', variant: 'yellow' }
  if (hitlType === 3) return { label: 'Pending — Email Preview', variant: 'yellow' }
  return { label: 'Processing', variant: 'blue' }
}

export function derivePipelineStage(job: JobDetail, hitlType: HitlType | null): StatusResult {
  if (job.status === 'queued') return { label: 'Queued', variant: 'gray' }
  if (job.status === 'success') return { label: isPlatformJob(job) ? 'Quote Sent' : 'Quote Accepted', variant: 'green' }
  if (job.status === 'failed') return { label: 'Failed', variant: 'red' }

  if (job.status === 'interrupted') {
    // Platform job: once email is sent the job is effectively done
    if (isPlatformJob(job) && isEmailSent(job.tasks))
      return { label: 'Quote Sent', variant: 'green' }
    // Email job: awaiting customer acknowledgement
    if (isAwaitingAck(job)) return { label: 'Quote Sent · Awaiting Ack', variant: 'blue' }
    const ratesDone = (job.tasks ?? []).some(
      (t) => t.title?.toLowerCase().includes('get_rate') &&
             (t.status === 'success' || t.status === 'completed')
    )
    if (!ratesDone) return { label: 'Gathering Info', variant: 'yellow' }
    if (hitlType === 1) return { label: 'Awaiting Shipment Confirmation', variant: 'purple' }
    if (hitlType === 2) return { label: 'Carrier Selection Pending', variant: 'purple' }
    if (hitlType === 3) return { label: 'Email Review Pending', variant: 'purple' }
    return { label: 'Interrupted', variant: 'yellow' }
  }

  if (hitlType === 1) return { label: 'Pending — Confirm Shipment', variant: 'purple' }
  if (hitlType === 2) return { label: 'Pending — Select Carrier', variant: 'yellow' }
  if (hitlType === 3) return { label: 'Pending — Email Preview', variant: 'yellow' }

  // running, no hitl — check currently running task title
  const runningTask = job.tasks?.find((t) => t.status === 'running')
  const title = runningTask?.title?.toLowerCase() ?? ''
  if (title.includes('get_tier'))   return { label: 'Extracting Details', variant: 'blue' }
  if (title.includes('get_rate'))   return { label: 'Fetching Rates', variant: 'blue' }
  if (title.includes('calculate'))  return { label: 'Calculating Quote', variant: 'blue' }
  if (title.includes('generate'))   return { label: 'Generating Email', variant: 'blue' }

  return { label: 'Processing', variant: 'blue' }
}

export function getInfoField(
  info: Array<{ label: string; value: string }> | null | undefined,
  label: string
): string | null {
  return info?.find((f) => f.label.toLowerCase() === label.toLowerCase())?.value ?? null
}

type ShipmentRow = { origin?: string; destination?: string; mode?: string; weight_kg?: number }

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
