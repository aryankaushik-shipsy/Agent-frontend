import { apiClient } from './client'

export interface HITLActionRequest {
  action: string
  edited_values?: Record<string, unknown>
  selected_candidate_id?: string
  candidate_edits?: Record<string, unknown>
  note?: string
}

export async function submitHitlAction(id: number, body: HITLActionRequest): Promise<void> {
  await apiClient.post(`/api/dashboard/hitl/${id}/action`, body)
}
