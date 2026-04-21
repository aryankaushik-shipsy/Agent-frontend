import { apiClient } from './client'

export interface HITLActionRequest {
  action: string
  edited_values?: Record<string, unknown>
  selected_candidate_id?: string
  candidate_edits?: Record<string, unknown>
  note?: string
  // Free-text guidance for retrigger actions — steers the agent's re-execution.
  // This one IS a real top-level field on HITLActionRequest.
  instruction?: string
  // Sibling payload for `free_text` interactions on non-retrigger actions.
  // IMPORTANT: the reviewer's free-text input must go inside
  // `data.free_text_input` — HITLActionRequest silently drops unknown
  // top-level fields (Pydantic `extra='ignore'`), so a top-level `free_text`
  // won't reach the server. The policy's action effect reads from
  // `source: "data.free_text_input"`.
  data?: Record<string, unknown>
}

export async function submitHitlAction(id: number, body: HITLActionRequest): Promise<void> {
  await apiClient.post(`/api/dashboard/hitl/${id}/action`, body)
}
