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
  // The n8n webhook is configured as GET — send threadID as a query param.
  const res = await axios.get(THREAD_WEBHOOK, { params: { threadID } })
  return res.data
}
