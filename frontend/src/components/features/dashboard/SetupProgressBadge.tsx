import { CheckCircle2, CircleDashed } from "lucide-react"
import { Link } from "react-router-dom"
import { useSetupSteps } from "@/hooks/useSetupSteps"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

export function SetupProgressBadge() {
  const { steps, doneCount, total, isComplete, isLoading } = useSetupSteps()

  if (isLoading) return <Skeleton className="h-6 w-40" />

  if (isComplete) {
    return (
      <div className="flex items-center gap-1.5 text-sm text-success">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        <span>Setup complete</span>
      </div>
    )
  }

  const firstMissing = steps.find((s) => !s.done)

  return (
    <Link
      to={firstMissing?.href ?? "/"}
      className={cn(
        "flex items-center gap-1.5 text-sm text-warning hover:underline underline-offset-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm",
      )}
    >
      <CircleDashed className="h-4 w-4" aria-hidden="true" />
      <span>
        Setup {doneCount}/{total} - finish {firstMissing?.label.toLowerCase()}
      </span>
    </Link>
  )
}
