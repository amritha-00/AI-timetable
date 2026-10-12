import { AlertTriangle, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useConstraints, useDeleteConstraint, useUpdateConstraint } from "@/hooks/useConstraints"
import type { Constraint, ConstraintType } from "@/types"
import { selectionFromPayload } from "./MiniWeekGrid"
import { TYPE_LABELS } from "./ParsedConstraintCard"

const overlaps = (a: number[], b: number[]) => a.length === 0 || b.length === 0 || a.some((x) => b.includes(x))

/** Ids of active constraints that appear to contradict another: same teacher
 * both unavailable and preferring overlapping slots. */
export function findContradictions(list: Constraint[]): Map<number, number> {
  const out = new Map<number, number>()
  const active = list.filter((c) => c.is_active)
  for (const a of active.filter((c) => c.constraint_type === "teacher_unavailable"))
    for (const b of active.filter((c) => c.constraint_type === "teacher_preferred_slot")) {
      if (a.payload.teacher_id !== b.payload.teacher_id) continue
      const sa = selectionFromPayload(a.payload)
      const sb = selectionFromPayload(b.payload)
      if (overlaps(sa.dayIds, sb.dayIds) && overlaps(sa.periods, sb.periods)) {
        out.set(a.id, b.id)
        out.set(b.id, a.id)
      }
    }
  return out
}

export function ConstraintsPanel() {
  const { data: constraints = [], isLoading } = useConstraints()
  const update = useUpdateConstraint()
  const remove = useDeleteConstraint()
  const conflicts = findContradictions(constraints)

  const groups = constraints.reduce<Record<string, Constraint[]>>((acc, c) => {
    ;(acc[c.constraint_type] ??= []).push(c)
    return acc
  }, {})

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading rules...</p>
  if (constraints.length === 0)
    return <p className="text-sm text-muted-foreground">No rules yet. Describe one in the chat and confirm it, and it will show up here.</p>

  return (
    <div className="space-y-5">
      {conflicts.size > 0 && (
        <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
          <p>Some rules seem to contradict each other (marked below). The timetable may ignore the softer one.</p>
        </div>
      )}
      {Object.entries(groups).map(([type, items]) => (
        <section key={type} className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {TYPE_LABELS[type as ConstraintType] ?? type} ({items.length})
          </h3>
          {items.map((c) => (
            <div key={c.id} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <p className="text-sm">{c.description ?? c.raw_text}</p>
              <p className="text-xs italic text-muted-foreground">"{c.raw_text}"</p>
              {conflicts.has(c.id) && (
                <p className="flex items-center gap-1 text-xs text-warning"><AlertTriangle className="h-3 w-3" /> Conflicts with another rule</p>
              )}
              <div className="flex items-center justify-between">
                <Badge variant={c.severity === "hard" ? "destructive" : "outline"}>{c.severity === "hard" ? "Must follow" : "Nice to have"}</Badge>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={c.is_active}
                    aria-label="Rule active"
                    onCheckedChange={(v) => update.mutate({ id: c.id, input: { is_active: v } })}
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Delete rule" onClick={() => remove.mutate(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
