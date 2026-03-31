import axios from 'axios'

// Dev: requests go through Vite proxy (/api → VITE_API_BASE_URL), baseURL = '/'
// Prod: no proxy — use VITE_API_BASE_URL directly so requests reach the backend
const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_BASE_URL as string)
  : '/'

const ORG_ID       = import.meta.env.VITE_ORGANISATION_ID as string
const INTERNAL_KEY = import.meta.env.VITE_INTERNAL_API_KEY as string

// Login goes through an n8n proxy webhook (server-side, no CORS restrictions).
// Credentials are hardcoded in the n8n HTTP Request node.
const LOGIN_URL = import.meta.env.VITE_LOGIN_PROXY_URL as string

// Token + user ID cached from login response; persisted in localStorage.
// Treated as stale after 12 h (well within the server-side 24 h expiry).
const TOKEN_TTL_MS    = 12 * 60 * 60 * 1000
const LS_TOKEN_KEY    = 'rfq_access_token'
const LS_USER_ID_KEY  = 'rfq_user_id'
const LS_FETCHED_KEY  = 'rfq_token_fetched_at'

// ─── localStorage helpers ─────────────────────────────────────────────────────

interface AuthCache { token: string; userId: string }

function readStoredAuth(): AuthCache | null {
  try {
    const token     = localStorage.getItem(LS_TOKEN_KEY)
    const userId    = localStorage.getItem(LS_USER_ID_KEY)
    const fetchedAt = parseInt(localStorage.getItem(LS_FETCHED_KEY) ?? '0', 10)
    if (token && userId && Date.now() - fetchedAt < TOKEN_TTL_MS) return { token, userId }
  } catch { /* localStorage blocked (e.g. incognito strict mode) */ }
  return null
}

function storeAuth(token: string, userId: string): void {
  try {
    localStorage.setItem(LS_TOKEN_KEY,   token)
    localStorage.setItem(LS_USER_ID_KEY, userId)
    localStorage.setItem(LS_FETCHED_KEY, String(Date.now()))
  } catch { /* ignore */ }
}

function clearStoredAuth(): void {
  try {
    localStorage.removeItem(LS_TOKEN_KEY)
    localStorage.removeItem(LS_USER_ID_KEY)
    localStorage.removeItem(LS_FETCHED_KEY)
  } catch { /* ignore */ }
}

// ─── Auth cache ───────────────────────────────────────────────────────────────

let cachedAuth: AuthCache | null = readStoredAuth()
let loginPromise: Promise<AuthCache> | null = null

async function fetchAuth(): Promise<AuthCache> {
  // n8n proxy has credentials hardcoded — no body needed from frontend
  const res = await axios.post(LOGIN_URL)
  const data = res.data?.data ?? res.data

  // Response shape: data.access_token.id  +  data.employee.id
  const token  = data?.access_token?.id ?? data?.access_token ?? null
  const userId = data?.employee?.id     ?? null

  if (!token)  throw new Error('[client] Login response missing access_token.id')
  if (!userId) throw new Error('[client] Login response missing employee.id')

  return { token: token as string, userId: String(userId) }
}

function ensureAuth(): Promise<AuthCache> {
  if (cachedAuth) return Promise.resolve(cachedAuth)
  if (!loginPromise) {
    loginPromise = fetchAuth()
      .then((auth) => {
        cachedAuth    = auth
        loginPromise  = null
        storeAuth(auth.token, auth.userId)
        console.info('[client] Auth refreshed — user:', auth.userId)
        return auth
      })
      .catch((err) => {
        loginPromise = null
        throw err
      })
  }
  return loginPromise
}

function refreshAuth(): Promise<AuthCache> {
  cachedAuth = null
  clearStoredAuth()
  return ensureAuth()
}

// Eager login on module load
ensureAuth().catch((err) => console.error('[client] Initial login failed:', err))

// Scheduled refresh every 12 h — keeps session alive in long-running tabs
setInterval(() => {
  console.info('[client] Scheduled auth refresh')
  refreshAuth().catch((err) => console.error('[client] Scheduled refresh failed:', err))
}, TOKEN_TTL_MS)

// ─── API client ───────────────────────────────────────────────────────────────

export const apiClient = axios.create({ baseURL: API_BASE })

apiClient.interceptors.request.use(async (config) => {
  const { token, userId } = await ensureAuth()
  config.headers['organisation-id']            = ORG_ID
  config.headers['user-id']                    = userId
  config.headers['access-token']               = token
  config.headers['ngrok-skip-browser-warning'] = 'true'
  return config
})

// On 401 — force re-login, retry once
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401 && !error.config._retried) {
      error.config._retried = true
      try {
        const { token, userId } = await refreshAuth()
        error.config.headers['access-token'] = token
        error.config.headers['user-id']      = userId
        return apiClient(error.config)
      } catch {
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

// ─── Internal client ──────────────────────────────────────────────────────────

export const internalClient = axios.create({ baseURL: API_BASE })

internalClient.interceptors.request.use((config) => {
  config.headers['organisation-id']            = ORG_ID
  config.headers['X-Internal-Api-Key']         = INTERNAL_KEY
  config.headers['ngrok-skip-browser-warning'] = 'true'
  return config
})
