import { Check } from "lucide-react"
import { Link } from "react-router-dom"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useSetupSteps } from "@/hooks/useSetupSteps"
import { cn } from "@/lib/utils"

export function SetupChecklist() {
  const { steps, doneCount, total, isLoading } = useSetupSteps()

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold">Setup checklist</h2>
        {!isLoading && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {doneCount}/{total} complete
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : (
        <ul className="space-y-1">
          {steps.map((step) => (
            <li key={step.key}>
              <Link
                to={step.href}
                className="flex items-center justify-between gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      step.done ? "border-success bg-success text-success-foreground" : "border-border text-transparent",
                    )}
                  >
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                  <span className={cn(step.done ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {step.done ? `${step.count}` : "Not started"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
