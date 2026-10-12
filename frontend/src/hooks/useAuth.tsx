import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { authApi, getToken, setToken } from "@/lib/api/auth"
import { usingMocks } from "@/lib/api/client"
import type { Tenant } from "@/types"

interface AuthContextValue {
  tenant: Tenant | null
  isLoading: boolean
  isAuthed: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (schoolName: string, email: string, password: string) => Promise<void>
  logout: () => void
  refreshTenant: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Demo mode never talks to the real backend, so it's treated as always
 * "signed in" with a placeholder tenant - the account menu reflects this. */
const DEMO_TENANT: Tenant = {
  id: 0,
  school_name: "Demo School",
  email: "demo@mode",
  is_subscribed: true,
  trial_generations_used: 0,
  trial_generations_remaining: 3,
  created_at: new Date().toISOString(),
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [tenant, setTenant] = useState<Tenant | null>(usingMocks() ? DEMO_TENANT : null)
  const [isLoading, setIsLoading] = useState(!usingMocks())
  const qc = useQueryClient()

  const refreshTenant = useCallback(async () => {
    if (usingMocks()) {
      setTenant(DEMO_TENANT)
      setIsLoading(false)
      return
    }
    if (!getToken()) {
      setTenant(null)
      setIsLoading(false)
      return
    }
    try {
      setTenant(await authApi.me())
    } catch {
      setToken(null)
      setTenant(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshTenant()
  }, [refreshTenant])

  const login = async (email: string, password: string) => {
    const res = await authApi.login({ email, password })
    setToken(res.access_token)
    setTenant(res.tenant)
  }

  const signup = async (schoolName: string, email: string, password: string) => {
    const res = await authApi.signup({ school_name: schoolName, email, password })
    setToken(res.access_token)
    setTenant(res.tenant)
  }

  const logout = () => {
    setToken(null)
    setTenant(null)
    qc.clear()
  }

  return (
    <AuthContext.Provider value={{ tenant, isLoading, isAuthed: !!tenant, login, signup, logout, refreshTenant }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
