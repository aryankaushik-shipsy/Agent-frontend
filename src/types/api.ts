import type { Job } from './job'

export interface JobFilter {
  statuses?: string[]
  workflow_ids?: number[]
  active_interventions?: boolean
  created_at_from?: string
  created_at_to?: string
  result_per_page?: number
  page_number?: number
  sort_by?: string
  order_by?: string
}

export interface JobsListResponse {
  jobs: Job[]
  total: number
  total_pages: number
  page_number: number
}

export interface AgentRunPayload {
  input_params: {
    threadID: string
    subject: string
    message: string
    sender: string
    messageID: string
    data: string
  }
  objectId: string
  objectType: 'Email'
  hubCode: string
  workflowId: string
  source: string
  ticketId: string
}

export interface AgentRunResponse {
  status: string
  job_id: number
  workflow_id: number
  message: string
}
