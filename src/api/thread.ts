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
  // Send as text/plain so the browser treats this as a CORS "simple request"
  // and skips the OPTIONS preflight entirely.  application/json triggers a
  // preflight which the webhook server's OPTIONS handler cannot handle (500).
  const res = await axios.post(
    THREAD_WEBHOOK,
    JSON.stringify({ threadID }),
    { headers: { 'Content-Type': 'text/plain' } },
  )
  return res.data
}
