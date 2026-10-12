import { useDays, usePeriods } from "@/hooks/usePeriods"
import { cn } from "@/lib/utils"

/** Which cells of the week a constraint touches. Empty dayIds = every day,
 * empty periods = every period (the backend's convention). */
export interface SlotSelection {
  dayIds: number[]
  periods: number[]
}

export function selectionFromPayload(payload: Record<string, unknown>): SlotSelection {
  return {
    dayIds: Array.isArray(payload.day_ids) ? (payload.day_ids as number[]) : [],
    periods: Array.isArray(payload.periods) ? (payload.periods as number[]) : [],
  }
}

interface MiniWeekGridProps {
  selection: SlotSelection
  tone?: "destructive" | "primary"
}

export function MiniWeekGrid({ selection, tone = "primary" }: MiniWeekGridProps) {
  const { data: days = [] } = useDays()
  const { data: allPeriods = [] } = usePeriods()
  const periods = allPeriods.filter((p) => !p.is_break)

  const dayOn = (id: number) => selection.dayIds.length === 0 || selection.dayIds.includes(id)
  const periodOn = (n: number) => selection.periods.length === 0 || selection.periods.includes(n)

  return (
    <div role="img" aria-label="Week grid showing the affected periods" className="inline-block">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: `auto repeat(${days.length}, 1.5rem)` }}>
        <span />
        {days.map((d) => (
          <span key={d.id} className="text-center text-[10px] text-muted-foreground">
            {d.name.slice(0, 1)}
          </span>
        ))}
        {periods.map((p) => (
          <div key={p.id} className="contents">
            <span className="pr-1 text-right font-mono text-[10px] text-muted-foreground">{p.period_number}</span>
            {days.map((d) => {
              const on = dayOn(d.id) && periodOn(p.period_number)
              return (
                <span
                  key={d.id}
                  className={cn(
                    "h-3.5 rounded-[3px]",
                    on ? (tone === "destructive" ? "bg-destructive/70" : "bg-primary/70") : "bg-muted",
                  )}
                />
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
