import { ArrowRight, CalendarRange, Sparkles } from "lucide-react"
import { Link } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useTimetables } from "@/hooks/useTimetables"
import { cn } from "@/lib/utils"

export function LatestTimetableCard() {
  const { data: timetables, isLoading } = useTimetables()

  if (isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-8 w-full" />
      </Card>
    )
  }

  const latest = [...(timetables ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0]

  if (!latest) {
    return (
      <Card className="p-5 flex flex-col items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
          <CalendarRange className="h-4.5 w-4.5" aria-hidden="true" />
        </div>
        <div>
          <h2 className="text-sm font-semibold">No timetable yet</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Once your setup is complete, generate your first clash-free timetable.
          </p>
        </div>
        <Button asChild size="sm">
          <Link to="/generate">
            <Sparkles className="h-4 w-4" /> Generate a timetable
          </Link>
        </Button>
      </Card>
    )
  }

  const statusClass =
    latest.status === "completed"
      ? "bg-success/15 text-success border-transparent"
      : latest.status === "failed"
        ? "bg-destructive/15 text-destructive border-transparent"
        : "bg-warning/15 text-warning border-transparent"

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold">Latest timetable</h2>
        <Badge className={cn("capitalize", statusClass)}>{latest.status}</Badge>
      </div>
      <p className="text-sm font-medium truncate">{latest.name}</p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {new Date(latest.created_at).toLocaleString()}
        {latest.score !== null && ` · score ${latest.score}`}
      </p>
      <div className="flex gap-2 mt-4">
        {latest.status === "completed" && (
          <Button asChild size="sm" variant="outline">
            <Link to={`/timetables?id=${latest.id}`}>
              View <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
        <Button asChild size="sm" variant="ghost">
          <Link to="/generate">Generate new</Link>
        </Button>
      </div>
    </Card>
  )
}
