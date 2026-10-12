import axios from "axios"
import { apiClient } from "./client"

const ADMIN_TOKEN_KEY = "admin_token"

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAdminToken(token: string | null) {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token)
    else localStorage.removeItem(ADMIN_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export interface AdminTenant {
  id: number
  school_name: string
  email: string
  is_subscribed: boolean
  trial_generations_used: number
  trial_generations_remaining: number
  created_at: string
  teacher_count: number
  class_count: number
  timetable_count: number
}

/** A second, independent axios instance: the admin token must never be sent
 * on a tenant request (or vice versa) - keeping the client separate makes
 * that a structural guarantee rather than something to remember. */
const adminClient = axios.create({ baseURL: apiClient.defaults.baseURL })
adminClient.interceptors.request.use((config) => {
  const token = getAdminToken()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const adminApi = {
  login: async (email: string, password: string): Promise<string> => {
    const { data } = await adminClient.post<{ access_token: string }>("/admin/login", { email, password })
    return data.access_token
  },
  listTenants: async (): Promise<AdminTenant[]> => {
    const { data } = await adminClient.get<AdminTenant[]>("/admin/tenants")
    return data
  },
  setSubscription: async (tenantId: number, isSubscribed: boolean): Promise<AdminTenant> => {
    const { data } = await adminClient.put<AdminTenant>(`/admin/tenants/${tenantId}/subscription`, {
      is_subscribed: isSubscribed,
    })
    return data
  },
}
