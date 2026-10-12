import type { AuthResponse, Tenant } from "@/types"
import { apiClient } from "./client"

export const TOKEN_KEY = "auth_token"

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore - private browsing etc. */
  }
}

export const authApi = {
  signup: async (input: { school_name: string; email: string; password: string }): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>("/auth/signup", input)
    return data
  },
  login: async (input: { email: string; password: string }): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>("/auth/login", input)
    return data
  },
  me: async (): Promise<Tenant> => {
    const { data } = await apiClient.get<Tenant>("/auth/me")
    return data
  },
  /** Mock billing - flips `is_subscribed` with no real payment processor. */
  upgrade: async (): Promise<Tenant> => {
    const { data } = await apiClient.post<Tenant>("/auth/upgrade")
    return data
  },
}
