import { CheckCircle2, Settings, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { PagePlaceholder } from "@/components/features/shared/PagePlaceholder"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { authApi } from "@/lib/api/auth"
import { usingMocks } from "@/lib/api/client"

const PLAN_FEATURES = [
  "Unlimited timetable generations",
  "All constraint types and exports",
  "Priority solver time limit",
]

function BillingSection() {
  const { tenant, refreshTenant } = useAuth()
  if (!tenant || usingMocks()) return null

  const upgrade = async () => {
    try {
      await authApi.upgrade()
      await refreshTenant()
      toast.success("You're on the unlimited plan now.")
    } catch {
      toast.error("Couldn't upgrade right now. Please try again.")
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-4 max-w-xl">
      <div>
        <h2 className="text-sm font-semibold">Billing</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {tenant.is_subscribed
            ? "You're on the unlimited plan."
            : `You've used ${tenant.trial_generations_used} of 3 free timetable generations.`}
        </p>
      </div>

      {tenant.is_subscribed ? (
        <ul className="space-y-1.5 text-sm">
          {PLAN_FEATURES.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" /> {f}
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="font-medium">Unlimited plan</span>
            <span className="text-sm text-muted-foreground">Demo pricing - no card required</span>
          </div>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {PLAN_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" /> {f}
              </li>
            ))}
          </ul>
          <Button onClick={upgrade}>
            <Sparkles className="h-4 w-4" /> Upgrade now
          </Button>
          <p className="text-xs text-muted-foreground">
            This is a demo checkout - it flips your plan immediately with no real payment taken.
          </p>
        </div>
      )}
    </section>
  )
}

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">School details, working days, and account preferences.</p>
      </div>
      <BillingSection />
      <PagePlaceholder
        icon={Settings}
        title="More settings are coming later"
        description="School name and logo, academic year, working days, LLM provider, and a danger zone for demo data - built in Phase 6."
        phaseNote="Phase 6 · Polish & accessibility"
      />
    </div>
  )
}
