import { apiClient } from './client'
import type { JobFilter, JobsListResponse } from '../types/api'
import type { JobDetail } from '../types/job'

export async function getJobs(filter: JobFilter): Promise<JobsListResponse> {
  const res = await apiClient.get('/api/dashboard/jobs/', {
    params: { filter: JSON.stringify(filter) },
  })
  return res.data
}

export async function getJobById(jobId: number): Promise<JobDetail> {
  const res = await apiClient.get(`/api/dashboard/jobs/${jobId}`)
  return res.data
}
