import axios from 'axios'

const THREAD_WEBHOOK = 'https://wbdemo.shipsy.io/webhook/get-thread'

export interface ThreadMessage {
  id?: string
  from?: string
  to?: string
  subject?: string
  body?: string
  html?: string
  timestamp?: string
  date?: string
  snippet?: string
  // catch-all for unknown fields
  [key: string]: unknown
}

export interface ThreadResponse {
  messages?: ThreadMessage[]
  thread?: ThreadMessage[]
  data?: ThreadMessage[]
  // raw fallback
  [key: string]: unknown
}

export async function getEmailThread(threadID: string): Promise<ThreadResponse> {
  // No explicit headers — let axios set Content-Type automatically.
  // An explicit Content-Type triggers a strict CORS preflight that the
  // webhook server's OPTIONS handler cannot handle (returns 500).
  const res = await axios.post(THREAD_WEBHOOK, { threadID })
  return res.data
}
