import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { CheckCircle2, CreditCard, Settings, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { PagePlaceholder } from "@/components/features/shared/PagePlaceholder"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/useAuth"
import { billingApi } from "@/lib/api/billing"
import { toFriendlyErrorMessage, usingMocks } from "@/lib/api/client"

const PLAN_FEATURES = [
  "Unlimited timetable generations",
  "All constraint types and exports",
  "Priority solver time limit",
]

function BillingSection() {
  const { tenant, refreshTenant } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null)

  // Returning from Stripe Checkout lands back here with ?checkout=success|cancelled.
  useEffect(() => {
    const result = searchParams.get("checkout")
    if (!result) return
    if (result === "success") {
      toast.success("Payment received - syncing your plan...")
      // The webhook that flips is_subscribed can land a beat after Stripe
      // redirects the browser back, so give it a moment before re-checking.
      setTimeout(() => refreshTenant(), 1500)
    } else if (result === "cancelled") {
      toast.info("Checkout cancelled - no charge was made.")
    }
    searchParams.delete("checkout")
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!tenant || usingMocks()) return null

  const upgrade = async () => {
    setBusy("checkout")
    try {
      const result = await billingApi.checkout()
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
        return // navigating away
      }
      await refreshTenant()
      toast.success("You're on the unlimited plan now.")
    } catch (err) {
      toast.error(toFriendlyErrorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const manage = async () => {
    setBusy("portal")
    try {
      const url = await billingApi.portal()
      window.location.href = url
    } catch (err) {
      toast.error(toFriendlyErrorMessage(err))
    } finally {
      setBusy(null)
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
        <>
          <ul className="space-y-1.5 text-sm">
            {PLAN_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" /> {f}
              </li>
            ))}
          </ul>
          <Button variant="outline" onClick={manage} disabled={busy === "portal"}>
            <CreditCard className="h-4 w-4" /> {busy === "portal" ? "Opening..." : "Manage billing"}
          </Button>
        </>
      ) : (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="font-medium">Unlimited plan</span>
          </div>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {PLAN_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-success" /> {f}
              </li>
            ))}
          </ul>
          <Button onClick={upgrade} disabled={busy === "checkout"}>
            <Sparkles className="h-4 w-4" /> {busy === "checkout" ? "Redirecting..." : "Upgrade now"}
          </Button>
          <p className="text-xs text-muted-foreground">You'll be taken to Stripe's secure checkout to complete payment.</p>
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
