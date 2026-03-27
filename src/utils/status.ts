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

  // running
  if (hitlType === 1) return { label: 'Pending — Confirm Shipment', variant: 'yellow' }
  if (hitlType === 2) return { label: 'Pending — Select Carrier', variant: 'yellow' }
  if (hitlType === 3) return { label: 'Pending — Email Preview', variant: 'yellow' }
  return { label: 'Processing', variant: 'blue' }
}

export function derivePipelineStage(job: JobDetail, hitlType: HitlType | null): StatusResult {
  if (job.status === 'queued') return { label: 'Queued', variant: 'gray' }
  if (job.status === 'success') return { label: 'Quote Sent', variant: 'green' }
  if (job.status === 'failed') return { label: 'Failed', variant: 'red' }
  if (job.status === 'interrupted') return { label: 'Interrupted', variant: 'yellow' }

  if (hitlType === 1) return { label: 'Pending — Confirm Shipment', variant: 'yellow' }
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

export function getCustomerName(info?: Record<string, string>): string {
  if (!info) return '—'
  return info.company_name || info.sender_email || '—'
}

export function getTierFromTasks(job: JobDetail): string {
  const tierTask = job.tasks?.find((t) => t.title?.toLowerCase().includes('get_tier'))
  if (!tierTask?.output_json) return '—'
  const out = tierTask.output_json as Record<string, unknown>
  return (out.tier as string) ?? '—'
}
