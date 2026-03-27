export type JobStatus = 'queued' | 'running' | 'success' | 'failed' | 'interrupted'

export interface Job {
  id: number
  status: JobStatus
  created_at: string
  runtime: number
  ticket_id?: string
  info?: Record<string, string>
}

export interface Task {
  id: number
  title: string
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
  ai_response: string
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
  status: 'pending' | 'resolved'
  interrupt: Interrupt
  action_taken?: string
  action_taken_by_user_name?: string
  action_taken_at?: string
}

export interface JobDetail extends Job {
  tasks: Task[]
  interventions: Intervention[]
}
