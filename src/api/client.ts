import axios from 'axios'

// Dev: requests go through Vite proxy (/api → VITE_API_BASE_URL), baseURL = '/'
// Prod: no proxy — use VITE_API_BASE_URL directly so requests reach the backend
const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_BASE_URL as string)
  : '/'

const ORG_ID         = import.meta.env.VITE_ORGANISATION_ID as string
const ORG_PRETTY     = import.meta.env.VITE_ORG_PRETTY_NAME as string
const ORG_URL        = import.meta.env.VITE_ORG_URL as string
const INTERNAL_KEY   = import.meta.env.VITE_INTERNAL_API_KEY as string
const USER_ID        = import.meta.env.VITE_USER_ID as string
const USERNAME       = import.meta.env.VITE_USERNAME as string
const PASSWORD       = import.meta.env.VITE_PASSWORD as string

// ─── Token cache ──────────────────────────────────────────────────────────────

let cachedToken: string | null = null
let loginPromise: Promise<string> | null = null

async function fetchAccessToken(): Promise<string> {
  const res = await axios.post(
    `${import.meta.env.VITE_API_BASE_URL}/api/dashboard/login`,
    { username: USERNAME, password: PASSWORD },
    {
      headers: {
        'content-type': 'application/json',
        'organisation-id': ORG_ID,
        'organisation-pretty-name': ORG_PRETTY,
        'organisation-url': ORG_URL,
      },
    }
  )
  // API may nest token under data.access_token or top-level access_token / token
  const token =
    res.data?.data?.access_token ??
    res.data?.access_token ??
    res.data?.token ??
    null
  if (!token) throw new Error('[client] Login response did not contain an access_token')
  return token as string
}

function ensureToken(): Promise<string> {
  if (cachedToken) return Promise.resolve(cachedToken)
  if (!loginPromise) {
    loginPromise = fetchAccessToken()
      .then((t) => {
        cachedToken = t
        loginPromise = null
        return t
      })
      .catch((err) => {
        loginPromise = null
        throw err
      })
  }
  return loginPromise
}

// Kick off login eagerly so the token is ready before the first API call
ensureToken().catch((err) => console.error('[client] Initial login failed:', err))

// ─── API client ───────────────────────────────────────────────────────────────

export const apiClient = axios.create({ baseURL: API_BASE })

// Attach token + org headers on every request
apiClient.interceptors.request.use(async (config) => {
  const token = await ensureToken()
  config.headers['organisation-id']  = ORG_ID
  config.headers['user-id']          = USER_ID
  config.headers['access-token']     = token
  config.headers['ngrok-skip-browser-warning'] = 'true'
  return config
})

// On 401 — invalidate cached token, re-login once, then retry the request
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retried) {
      error.config._retried = true
      cachedToken = null
      try {
        const token = await ensureToken()
        error.config.headers['access-token'] = token
        return apiClient(error.config)
      } catch {
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

// ─── Internal client (unchanged) ─────────────────────────────────────────────

export const internalClient = axios.create({ baseURL: API_BASE })

internalClient.interceptors.request.use((config) => {
  config.headers['organisation-id'] = ORG_ID
  config.headers['X-Internal-Api-Key'] = INTERNAL_KEY
  config.headers['ngrok-skip-browser-warning'] = 'true'
  return config
})
