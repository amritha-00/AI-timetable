import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { CalendarRange, LogOut, RefreshCw, ShieldCheck, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { adminApi, type AdminTenant, getAdminToken, setAdminToken } from "@/lib/api/admin"
import { toFriendlyErrorMessage } from "@/lib/api/client"

export default function AdminPanel() {
  const [authed, setAuthed] = useState(!!getAdminToken())
  const [tenants, setTenants] = useState<AdminTenant[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setTenants(await adminApi.listTenants())
    } catch (err) {
      if (err && typeof err === "object" && "response" in err && (err as any).response?.status === 401) {
        setAdminToken(null)
        setAuthed(false)
      } else {
        toast.error(toFriendlyErrorMessage(err))
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (authed) load()
  }, [authed])

  if (!authed) return <Navigate to="/admin/login" replace />

  const toggle = async (t: AdminTenant) => {
    setBusyId(t.id)
    try {
      const updated = await adminApi.setSubscription(t.id, !t.is_subscribed)
      setTenants((prev) => prev?.map((x) => (x.id === t.id ? updated : x)) ?? null)
      toast.success(updated.is_subscribed ? `${t.school_name} is now on the unlimited plan` : `${t.school_name}'s plan was reset to trial`)
    } catch (err) {
      toast.error(toFriendlyErrorMessage(err))
    } finally {
      setBusyId(null)
    }
  }

  const logout = () => {
    setAdminToken(null)
    setAuthed(false)
  }

  const totals = tenants
    ? {
        schools: tenants.length,
        subscribed: tenants.filter((t) => t.is_subscribed).length,
        timetables: tenants.reduce((s, t) => s + t.timetable_count, 0),
      }
    : null

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <ShieldCheck className="h-5 w-5 text-primary" /> Admin panel
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        {totals && (
          <div className="grid grid-cols-3 gap-3 max-w-md">
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <div className="text-xl font-semibold tabular-nums">{totals.schools}</div>
              <div className="text-xs text-muted-foreground">Schools</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <div className="text-xl font-semibold tabular-nums">{totals.subscribed}</div>
              <div className="text-xs text-muted-foreground">On unlimited</div>
            </div>
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <div className="text-xl font-semibold tabular-nums">{totals.timetables}</div>
              <div className="text-xs text-muted-foreground">Timetables made</div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-medium">School</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Plan</th>
                <th className="px-4 py-3 font-medium">Trial used</th>
                <th className="px-4 py-3 font-medium">Teachers</th>
                <th className="px-4 py-3 font-medium">Classes</th>
                <th className="px-4 py-3 font-medium">Timetables</th>
                <th className="px-4 py-3 font-medium">Signed up</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading && !tenants ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
                </tr>
              ) : tenants && tenants.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No schools have signed up yet.</td>
                </tr>
              ) : (
                tenants?.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 font-medium">{t.school_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{t.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={t.is_subscribed ? "secondary" : "outline"}>
                        {t.is_subscribed ? "Unlimited" : "Trial"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {t.is_subscribed ? "-" : `${t.trial_generations_used} / 3`}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{t.teacher_count}</td>
                    <td className="px-4 py-3 tabular-nums">{t.class_count}</td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <CalendarRange className="h-3.5 w-3.5 text-muted-foreground" /> {t.timetable_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(t.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant={t.is_subscribed ? "outline" : "default"}
                        disabled={busyId === t.id}
                        onClick={() => toggle(t)}
                      >
                        {t.is_subscribed ? "Revert to trial" : <><Sparkles className="h-3.5 w-3.5" /> Grant unlimited</>}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  )
}
