import { internalClient } from './client'
import type { AgentRunPayload, AgentRunResponse } from '../types/api'

export async function runAgent(payload: AgentRunPayload): Promise<AgentRunResponse> {
  const res = await internalClient.post('/api/internal/agent/run', payload)
  return res.data
}
