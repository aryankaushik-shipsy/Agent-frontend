import axios from 'axios'

const THREAD_WEBHOOK = 'https://wbdemo.shipsy.io/webhook/get-thread'

export interface ThreadMessage {
  id?: string
  threadId?: string
  // Gmail-style capitalized headers
  From?: string
  To?: string
  Subject?: string
  snippet?: string
  internalDate?: string   // unix ms as string e.g. "1774940274000"
  payload?: { mimeType?: string }
  labels?: Array<{ id: string; name: string }>
  sizeEstimate?: number
  historyId?: string
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
  const res = await axios.post(THREAD_WEBHOOK, { threadID })
  return res.data
}

export async function getEmailMessage(messageId: string): Promise<ThreadResponse> {
  const res = await axios.post(THREAD_WEBHOOK, { messageId })
  return res.data
}
