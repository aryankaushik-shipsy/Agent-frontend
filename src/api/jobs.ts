import { apiClient } from './client'
import type { JobFilter, JobsListResponse } from '../types/api'
import type { JobDetail } from '../types/job'

function extractInfoField(info: Array<{ label: string; value: string }> | undefined, label: string): string | null {
  if (!Array.isArray(info)) return null
  return info.find((f) => f.label?.toLowerCase() === label.toLowerCase())?.value ?? null
}

export async function getJobs(filter: JobFilter): Promise<JobsListResponse> {
  const res = await apiClient.get('/api/dashboard/jobs/', {
    params: { filter: JSON.stringify(filter) },
  })
  const raw = res.data
  // Actual API shape: { pagination: { count, page_number, total_pages }, data: [{ jobs: [...] }] }
  const pagination = raw.pagination ?? {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawJobs: any[] = raw.data?.[0]?.jobs ?? raw.jobs ?? []
  // Normalize ticket_id on each list job too (same Trace Reference logic)
  const jobs = rawJobs.map((j) => {
    if (!j.ticket_id) {
      j.ticket_id = extractInfoField(j.info, 'Trace Reference') ?? null
    }
    return j
  })
  return {
    jobs,
    total: pagination.count ?? raw.total ?? 0,
    total_pages: pagination.total_pages ?? raw.total_pages ?? 1,
    page_number: pagination.page_number ?? raw.page_number ?? 1,
  }
}

export async function getJobById(jobId: number): Promise<JobDetail> {
  const res = await apiClient.get(`/api/dashboard/jobs/${jobId}`)
  let raw = res.data
  // Unwrap if nested: { data: { ... } } or { data: [{ ... }] }
  if (raw.data && !Array.isArray(raw.data)) raw = raw.data
  else if (Array.isArray(raw.data) && raw.data[0]) raw = raw.data[0]
  // Normalize key: API returns "interventions"; legacy may return "hitl_records"
  if (!raw.interventions && raw.hitl_records) raw = { ...raw, interventions: raw.hitl_records }
  raw.interventions = raw.interventions ?? []

  // Normalize ticket_id: first check top-level field aliases, then
  // look inside info[] for the "Trace Reference" label (primary source).
  if (!raw.ticket_id) {
    raw.ticket_id =
      raw.thread_id ??
      raw.ticketId ??
      raw.email_thread_id ??
      raw.threadId ??
      raw.email_id ??
      raw.source_id ??
      extractInfoField(raw.info, 'Trace Reference') ??
      null
  }

  return raw
}
