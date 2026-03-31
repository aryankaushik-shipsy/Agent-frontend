import axios from 'axios'

// Dev: requests go through Vite proxy (/api → VITE_API_BASE_URL), baseURL = '/'
// Prod: no proxy — use VITE_API_BASE_URL directly so requests reach the backend
const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_BASE_URL as string)
  : '/'

const ORG_ID       = import.meta.env.VITE_ORGANISATION_ID as string
const INTERNAL_KEY = import.meta.env.VITE_INTERNAL_API_KEY as string
const USER_ID          = import.meta.env.VITE_USER_ID as string
const USERNAME         = import.meta.env.VITE_USERNAME as string
const PASSWORD         = import.meta.env.VITE_PASSWORD as string

// Login goes through an n8n proxy webhook (server-side, no CORS restrictions).
// The proxy forwards the request to demodashboardapi.shipsy.in with the required
// organisation headers. Set VITE_LOGIN_PROXY_URL to your n8n webhook URL.
const LOGIN_URL = import.meta.env.VITE_LOGIN_PROXY_URL as string

// Token is stored in localStorage so it survives page reloads.
// We treat it as expired after TOKEN_TTL_MS to guarantee a fresh one well within
// the server-side 24 h window.
const TOKEN_TTL_MS   = 12 * 60 * 60 * 1000   // 12 hours
const LS_TOKEN_KEY   = 'rfq_access_token'
const LS_FETCHED_KEY = 'rfq_token_fetched_at'

// ─── Token helpers ────────────────────────────────────────────────────────────

function readStoredToken(): string | null {
  try {
    const token     = localStorage.getItem(LS_TOKEN_KEY)
    const fetchedAt = parseInt(localStorage.getItem(LS_FETCHED_KEY) ?? '0', 10)
    if (token && Date.now() - fetchedAt < TOKEN_TTL_MS) return token
  } catch { /* localStorage blocked (e.g. incognito strict mode) */ }
  return null
}

function storeToken(token: string): void {
  try {
    localStorage.setItem(LS_TOKEN_KEY, token)
    localStorage.setItem(LS_FETCHED_KEY, String(Date.now()))
  } catch { /* ignore */ }
}

function clearStoredToken(): void {
  try {
    localStorage.removeItem(LS_TOKEN_KEY)
    localStorage.removeItem(LS_FETCHED_KEY)
  } catch { /* ignore */ }
}

// ─── Token cache + refresh ────────────────────────────────────────────────────

let cachedToken: string | null = readStoredToken()
let loginPromise: Promise<string> | null = null

async function fetchAccessToken(): Promise<string> {
  // POST to n8n proxy — the proxy attaches org headers and forwards to
  // demodashboardapi.shipsy.in server-side, bypassing browser CORS entirely.
  const res = await axios.post(
    LOGIN_URL,
    { username: USERNAME, password: PASSWORD }
  )
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
        storeToken(t)
        loginPromise = null
        console.info('[client] Access token refreshed')
        return t
      })
      .catch((err) => {
        loginPromise = null
        throw err
      })
  }
  return loginPromise
}

/** Force-fetch a fresh token (ignores cache). Used by refresh scheduler & 401 handler. */
function refreshToken(): Promise<string> {
  cachedToken = null
  clearStoredToken()
  return ensureToken()
}

// Eager login on module load
ensureToken().catch((err) => console.error('[client] Initial login failed:', err))

// Scheduled refresh every 12 hours — keeps the token alive in long-running sessions
setInterval(() => {
  console.info('[client] Scheduled token refresh')
  refreshToken().catch((err) => console.error('[client] Scheduled refresh failed:', err))
}, TOKEN_TTL_MS)

// ─── API client ───────────────────────────────────────────────────────────────

export const apiClient = axios.create({ baseURL: API_BASE })

// Attach token + org headers on every request
apiClient.interceptors.request.use(async (config) => {
  const token = await ensureToken()
  config.headers['organisation-id']            = ORG_ID
  config.headers['user-id']                    = USER_ID
  config.headers['access-token']               = token
  config.headers['ngrok-skip-browser-warning'] = 'true'
  return config
})

// On 401 — force token refresh, then retry the request once
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retried) {
      error.config._retried = true
      try {
        const token = await refreshToken()
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
  config.headers['organisation-id']            = ORG_ID
  config.headers['X-Internal-Api-Key']         = INTERNAL_KEY
  config.headers['ngrok-skip-browser-warning'] = 'true'
  return config
})
