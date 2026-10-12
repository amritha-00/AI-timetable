import axios from "axios"

/**
 * Single axios instance every real API module builds on. In dev, requests
 * go through Vite's proxy (see vite.config.ts) at a relative /api path; a
 * production build talks directly to VITE_API_URL.
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.DEV ? "/api" : import.meta.env.VITE_API_URL || "/api",
  headers: { "Content-Type": "application/json" },
})

const TOKEN_KEY = "auth_token"

// Attach the signed-in school's token to every real request. Demo mode
// (usingMocks()) never hits the backend, so no token is needed there.
apiClient.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token) config.headers.Authorization = `Bearer ${token}`
  } catch {
    /* ignore */
  }
  return config
})

// An expired/invalid token means the app is still "logged in" client-side
// but every request will 401 - bounce to /login instead of showing a wall
// of "please sign in" errors on every panel.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401 && !usingMocks()) {
      try {
        localStorage.removeItem(TOKEN_KEY)
      } catch {
        /* ignore */
      }
      if (!location.pathname.startsWith("/login") && !location.pathname.startsWith("/signup")) {
        location.assign("/login")
      }
    }
    return Promise.reject(error)
  },
)

/** True when the app should read/write the in-memory mock layer instead of
 * making real HTTP calls - see src/lib/api/mocks. Toggled by the "Load demo
 * school" flow and by VITE_USE_MOCKS for local development without a
 * backend running. */
export function usingMocks(): boolean {
  return localStorage.getItem("use_mocks") === "true" || import.meta.env.VITE_USE_MOCKS === "true"
}

export function setUsingMocks(value: boolean) {
  localStorage.setItem("use_mocks", String(value))
}

/**
 * Turns any axios/network error into the one plain-English sentence the UI
 * is allowed to show - admins never see raw JSON, status codes, or stack
 * traces (see the "no technical jargon" requirement).
 */
export function toFriendlyErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return "Can't reach the server. Check your connection and try again."
    }
    const detail = error.response.data?.detail
    if (typeof detail === "string") return detail
    if (Array.isArray(detail) && detail[0]?.msg) {
      return "Some of the information entered isn't valid. Please check the form and try again."
    }
    if (error.response.status === 404) return "That item couldn't be found - it may have been deleted."
    if (error.response.status >= 500) return "Something went wrong on our end. Please try again in a moment."
    return "Something went wrong. Please try again."
  }
  if (error instanceof Error) return error.message
  return "Something unexpected went wrong. Please try again."
}
