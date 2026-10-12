import { AlertTriangle } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useCreateDay, useDays, useDeleteDay } from "@/hooks/usePeriods"

const WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

/**
 * A fresh school starts with zero days in the database - the generator
 * can't schedule anything without at least one, so this has to be the
 * first thing a new tenant sets up, before periods even make sense.
 */
export function WorkingDaysSection() {
  const { data: days = [], isLoading } = useDays()
  const createDay = useCreateDay()
  const deleteDay = useDeleteDay()

  const toggle = (name: string, checked: boolean) => {
    if (checked) {
      const nextIndex = (days.reduce((max, d) => Math.max(max, d.order_index), 0) || 0) + 1
      createDay.mutate({ name, order_index: nextIndex })
    } else {
      const existing = days.find((d) => d.name === name)
      if (existing) deleteDay.mutate(existing.id)
    }
  }

  return (
    <section className="rounded-lg border border-border p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Working days</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Which days of the week your school holds classes. Needed before anything else here.
        </p>
      </div>
      {!isLoading && days.length === 0 && (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5" /> No working days set yet - the timetable can't be generated until you pick at least one.
        </p>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {WEEK.map((name) => {
          const checked = days.some((d) => d.name === name)
          return (
            <div key={name} className="flex items-center gap-2">
              <Checkbox
                id={`day-${name}`}
                checked={checked}
                disabled={isLoading || createDay.isPending || deleteDay.isPending}
                onCheckedChange={(v) => toggle(name, v === true)}
              />
              <Label htmlFor={`day-${name}`} className="text-sm font-normal cursor-pointer">
                {name}
              </Label>
            </div>
          )
        })}
      </div>
    </section>
  )
}
