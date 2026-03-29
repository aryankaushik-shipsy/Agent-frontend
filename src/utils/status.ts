import type { JobDetail, JobStatus } from '../types/job'
import type { HitlType } from '../types/hitl'

export type BadgeVariant = 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'gray'

export interface StatusResult {
  label: string
  variant: BadgeVariant
}

export function deriveJobStatus(
  status: JobStatus,
  hitlType: HitlType | null
): StatusResult {
  if (status === 'queued') return { label: 'Queued', variant: 'gray' }
  if (status === 'success') return { label: 'Sent', variant: 'green' }
  if (status === 'failed') return { label: 'Failed', variant: 'red' }
  if (status === 'interrupted') return { label: 'Interrupted', variant: 'yellow' }

  // running or interrupted with pending HITL
  if (hitlType === 1) return { label: 'Pending — Confirm Shipment', variant: 'purple' }
  if (hitlType === 2) return { label: 'Pending — Select Carrier', variant: 'yellow' }
  if (hitlType === 3) return { label: 'Pending — Email Preview', variant: 'yellow' }
  return { label: 'Processing', variant: 'blue' }
}

export function derivePipelineStage(job: JobDetail, hitlType: HitlType | null): StatusResult {
  if (job.status === 'queued') return { label: 'Queued', variant: 'gray' }
  if (job.status === 'success') return { label: 'Quote Sent', variant: 'green' }
  if (job.status === 'failed') return { label: 'Failed', variant: 'red' }
  if (job.status === 'interrupted') return { label: 'Interrupted', variant: 'yellow' }

  if (hitlType === 1) return { label: 'Pending — Confirm Shipment', variant: 'purple' }
  if (hitlType === 2) return { label: 'Pending — Select Carrier', variant: 'yellow' }
  if (hitlType === 3) return { label: 'Pending — Email Preview', variant: 'yellow' }

  // running, no hitl — check task title
  const runningTask = job.tasks?.find((t) => t.status === 'running')
  const title = runningTask?.title?.toLowerCase() ?? ''
  if (title.includes('get_tier')) return { label: 'Extracting Details', variant: 'blue' }
  if (title.includes('get_rate')) return { label: 'Fetching Rates', variant: 'blue' }
  if (title.includes('calculate')) return { label: 'Calculating Quote', variant: 'blue' }
  if (title.includes('generate')) return { label: 'Generating Email', variant: 'blue' }

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
