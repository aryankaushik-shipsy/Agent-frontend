import { apiClient } from './client'

export async function submitHitlAction(id: number, action: string): Promise<void> {
  await apiClient.post(`/api/dashboard/hitl/${id}/action`, { action })
}
