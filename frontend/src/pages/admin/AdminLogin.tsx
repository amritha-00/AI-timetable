import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangle, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { adminApi, setAdminToken } from "@/lib/api/admin"
import { toFriendlyErrorMessage } from "@/lib/api/client"

export default function AdminLoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const token = await adminApi.login(email, password)
      setAdminToken(token)
      navigate("/admin", { replace: true })
    } catch (err) {
      setError(toFriendlyErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-background">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Admin sign in</h1>
          <p className="text-sm text-muted-foreground">Platform owner access - not a school account.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6">
          {error && (
            <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="admin-email">Email</Label>
            <Input id="admin-email" type="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-password">Password</Label>
            <Input id="admin-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  )
}
