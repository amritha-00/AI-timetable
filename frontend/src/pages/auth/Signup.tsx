import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { AlertTriangle, CalendarClock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/hooks/useAuth"
import { toFriendlyErrorMessage } from "@/lib/api/client"

export default function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [schoolName, setSchoolName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError("Password must be at least 8 characters.")
      return
    }
    setBusy(true)
    try {
      await signup(schoolName, email, password)
      navigate("/dashboard", { replace: true })
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
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <CalendarClock className="h-5 w-5" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">Set up your school</h1>
          <p className="text-sm text-muted-foreground">3 free timetable generations, no card needed</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6">
          {error && (
            <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="school_name">School name</Label>
            <Input id="school_name" required autoFocus value={schoolName} onChange={(e) => setSchoolName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            <p className="text-xs text-muted-foreground">At least 8 characters.</p>
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating account..." : "Create account"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already set up?{" "}
          <Link to="/login" className="text-primary underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
