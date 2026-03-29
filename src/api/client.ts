import axios from 'axios'

// Dev: requests go through Vite proxy (/api → VITE_API_BASE_URL), baseURL = '/'
// Prod: no proxy — use VITE_API_BASE_URL directly so requests reach the backend
const API_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_BASE_URL as string)
  : '/'

const ORG_ID = import.meta.env.VITE_ORGANISATION_ID as string
const INTERNAL_KEY = import.meta.env.VITE_INTERNAL_API_KEY as string
const USER_ID = import.meta.env.VITE_USER_ID as string
const ACCESS_TOKEN = import.meta.env.VITE_ACCESS_TOKEN as string

export const apiClient = axios.create({
  baseURL: API_BASE,
})

// Dashboard endpoints require all three ProjectX user headers.
// ngrok-skip-browser-warning bypasses the ngrok interstitial page (ERR_NGROK_6024).
apiClient.interceptors.request.use((config) => {
  config.headers['organisation-id'] = ORG_ID
  config.headers['user-id'] = USER_ID
  config.headers['access-token'] = ACCESS_TOKEN
  config.headers['ngrok-skip-browser-warning'] = 'true'
  return config
})

export const internalClient = axios.create({
  baseURL: API_BASE,
})

internalClient.interceptors.request.use((config) => {
  config.headers['organisation-id'] = ORG_ID
  config.headers['X-Internal-Api-Key'] = INTERNAL_KEY
  config.headers['ngrok-skip-browser-warning'] = 'true'
  return config
})
