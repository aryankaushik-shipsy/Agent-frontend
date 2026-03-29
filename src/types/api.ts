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
  workflowId: string | number
  sender_email: string
  company_name: string
  contact_name?: string
  commodity: string
  notes?: string
  data: Array<{
    origin: string
    destination: string
    mode: 'Air'
    weight_kg: number
    date: string
    length_cm: number
    width_cm: number
    height_cm: number
    number_of_boxes: number
  }>
}

export interface AgentRunResponse {
  status: string
  job_id: number
  workflow_id: number
  message: string
}
