import axios from 'axios'
import { useAuth } from '@clerk/react'

// Base axios instance — all API calls go through this
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30_000,
})

// Hook: get an authenticated axios instance
// Usage: const { api } = useApi()
export function useApi() {
  const { getToken } = useAuth()

  const authApi = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api',
    timeout: 30_000,
  })

  // Attach Bearer token to every request
  authApi.interceptors.request.use(async (config) => {
    const token = await getToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  })

  // Normalise error responses
  authApi.interceptors.response.use(
    (res) => res,
    (err) => {
      const status = err.response?.status
      if (status === 401) {
        // Token expired or invalid — Clerk will handle refresh on next getToken()
        console.warn('[DATAClaw] 401 — session may have expired')
      }
      return Promise.reject(err)
    }
  )

  return { api: authApi }
}

export default api
