import { apiClient } from './client'
import type { InsightsResponse } from '../types/insights'

export async function getInsights(from: string, to: string): Promise<InsightsResponse> {
  const res = await apiClient.get('/api/dashboard/insights', {
    params: { from, to },
  })
  return res.data
}
