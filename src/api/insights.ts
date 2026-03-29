import { apiClient } from './client'
import type { InsightsResponse } from '../types/insights'

export async function getInsights(from: string, to: string): Promise<InsightsResponse> {
  const res = await apiClient.get('/api/dashboard/insights', {
    params: { from, to },
  })
  const raw = res.data
  // Normalize: some responses wrap in { data: { ... } }
  const payload = raw?.data ?? raw
  return {
    metrics: payload?.metrics ?? [],
    active_interventions: payload?.active_interventions ?? 0,
  }
}
