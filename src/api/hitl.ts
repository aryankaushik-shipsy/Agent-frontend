import { apiClient } from './client'

export interface HITLActionRequest {
  action: string
  edited_values?: Record<string, unknown>
  selected_candidate_id?: string
  candidate_edits?: Record<string, unknown>
  note?: string
  // Free-text guidance for retrigger actions — steers the agent's re-execution
  instruction?: string
  // Free-text sibling to a candidate_selection / other `free_text` interaction
  // — written to state via the action's effects (e.g. execution_variables.<x>).
  free_text?: string
}

export async function submitHitlAction(id: number, body: HITLActionRequest): Promise<void> {
  await apiClient.post(`/api/dashboard/hitl/${id}/action`, body)
}
