import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL as string
const ORG_ID = import.meta.env.VITE_ORGANISATION_ID as string
const INTERNAL_KEY = import.meta.env.VITE_INTERNAL_API_KEY as string

export const apiClient = axios.create({
  baseURL: BASE_URL,
})

apiClient.interceptors.request.use((config) => {
  config.headers['organisation-id'] = ORG_ID
  return config
})

export const internalClient = axios.create({
  baseURL: BASE_URL,
})

internalClient.interceptors.request.use((config) => {
  config.headers['organisation-id'] = ORG_ID
  config.headers['X-Internal-Api-Key'] = INTERNAL_KEY
  return config
})
