import type { HITLInterruptPayload } from './hitl'

export type JobStatus = 'queued' | 'running' | 'success' | 'failed' | 'interrupted'

export interface InfoField {
  label: string
  value: string
  meta?: unknown
}

export interface Job {
  id: number
  status: JobStatus
  created_at: string
  started_at?: string | null
  completed_at?: string | null
  runtime: number | null
  ticket_id?: string | null
  workflow_id?: number
  assigned_agent?: string
  // platform-processed labelled fields (from input_data_fields config)
  info?: InfoField[]
  // raw form submission data
  input_json?: {
    type?: string          // 'Platform' | 'Inbound Email'
    sender_email?: string
    company_name?: string
    contact_name?: string
    commodity?: string
    notes?: string
    data?: unknown[]
  }
}

export interface Task {
  id: number
  title: string
  node_key?: string
  status: string
  running_time: number
  summary?: string
  output_json?: unknown
}

export interface InterruptAction {
  id: string
  label: string
}

export interface InterruptDetails {
  // May be a pre-parsed object (Type 1/2) or a raw HTML string (Type 3)
  ai_response: string | Record<string, unknown>
  summary?: string
}

export interface Interrupt {
  details: InterruptDetails
  actions: InterruptAction[]
  recommendation?: string
  confidence?: number
  question?: string
}

export interface Intervention {
  id: number
  // Multi-step HITL fields — the same record advances through steps
  status?: string                         // "pending" | "completed"
  current_step?: number                   // 0, 1, 2 …
  total_steps?: number                    // e.g. 3
  // Structured payload from the policy engine — use this for all new HITL rendering
  interrupt_message?: HITLInterruptPayload
  // Legacy interrupt shape — kept for backward compat with pre-policy-upgrade jobs
  interrupt: Interrupt
  action_taken?: string | null
  action_taken_by_user_name?: string | null
  action_taken_at?: string | null
  note_reference?: string | null
  created_at?: string
}

export interface JobDetail extends Job {
  tasks: Task[]
  interventions: Intervention[]        // API key (confirmed)
  hitl_records?: Intervention[]        // optional alias — kept for safety
}
