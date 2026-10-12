import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useClasses } from "@/hooks/useClasses"
import { useAllEntries } from "@/hooks/useTimetables"
import { useConstraints } from "@/hooks/useConstraints"
import type { Constraint, Timetable, TimetableEntry } from "@/types"

const nums = (v: unknown): number[] => (Array.isArray(v) ? (v as number[]) : [])
const inSlot = (e: TimetableEntry, p: Record<string, unknown>) =>
  (nums(p.day_ids).length === 0 || nums(p.day_ids).includes(e.day_id)) &&
  (nums(p.periods).length === 0 || nums(p.periods).includes(e.period_number))

/** Lessons that break this rule in the given timetable (0 = followed). */
export function violations(c: Constraint, all: TimetableEntry[], classTeacher: Map<number, number | null> = new Map()): number {
  const p = c.payload
  const mine = (e: TimetableEntry) =>
    (p.teacher_id === undefined || e.teacher_id === p.teacher_id) &&
    (p.subject_id === undefined || e.subject_id === p.subject_id) &&
    (p.class_id === undefined || p.class_id === null || e.class_id === p.class_id)
  switch (c.constraint_type) {
    case "teacher_unavailable":
      return all.filter((e) => mine(e) && inSlot(e, p)).length
    case "teacher_preferred_slot":
    case "subject_time_preference":
      return all.filter((e) => mine(e) && !inSlot(e, p)).length
    case "class_subject_assignment": {
      const rows = all.filter((e) => e.class_id === p.class_id && e.subject_id === p.subject_id)
      const wrongTeacher = p.teacher_id ? rows.filter((e) => e.teacher_id !== p.teacher_id).length : 0
      const wrongCount = p.periods_per_week && rows.length !== Number(p.periods_per_week) ? 1 : 0
      return wrongTeacher + wrongCount
    }
    case "class_teacher_period": {
      // Broken when a class's teacher teaches that class at other times but not in the requested slot.
      let bad = 0
      for (const [classId, ct] of classTeacher) {
        if ((p.class_id != null && p.class_id !== classId) || ct == null) continue
        const own = all.filter((e) => e.class_id === classId && e.teacher_id === ct)
        const inWanted = own.filter((e) => nums(p.periods).includes(e.period_number)).length
        const wantedSlots = new Set(all.filter((e) => e.class_id === classId && nums(p.periods).includes(e.period_number)).map((e) => e.day_id)).size
        if (own.length > inWanted && inWanted < wantedSlots) bad++
      }
      return bad
    }
    case "room_requirement":
      return all.filter((e) => mine(e) && !nums(p.room_ids).includes(e.room_id)).length
    case "max_periods_per_day": {
      const per = new Map<string, number>()
      for (const e of all.filter(mine)) {
        const k = `${p.scope === "teacher" ? e.teacher_id : `${e.class_id}-${e.subject_id}`}-${e.day_id}`
        per.set(k, (per.get(k) ?? 0) + 1)
      }
      return [...per.values()].filter((n) => n > Number(p.max_periods)).length
    }
    case "no_consecutive": {
      const byDay = new Map<number, number[]>()
      for (const e of all.filter(mine)) byDay.set(e.day_id, [...(byDay.get(e.day_id) ?? []), e.period_number])
      let bad = 0
      for (const ps of byDay.values()) {
        ps.sort((a, b) => a - b)
        let run = 1
        for (let i = 1; i < ps.length; i++) {
          run = ps[i] === ps[i - 1] + 1 ? run + 1 : 1
          if (run > Number(p.max_consecutive)) bad++
        }
      }
      return bad
    }
  }
}

/** Share of active rules a timetable fully follows, as whole percentages. */
export function compliance(constraints: Constraint[], entries: TimetableEntry[], classTeacher?: Map<number, number | null>) {
  const rows = constraints.map((c) => ({ c, bad: violations(c, entries, classTeacher) }))
  const pct = (list: typeof rows) => (list.length ? Math.round((list.filter((r) => r.bad === 0).length / list.length) * 100) : 100)
  return { rows, percent: pct(rows), hardPercent: pct(rows.filter((r) => r.c.severity === "hard")), softPercent: pct(rows.filter((r) => r.c.severity === "soft")) }
}

export function RulesScore({ timetableId }: { timetableId: number }) {
  const { data: constraints = [] } = useConstraints(true)
  const { data: entries = [] } = useAllEntries(timetableId)
  const { data: classes = [] } = useClasses()
  if (constraints.length === 0 || entries.length === 0) return null
  const { percent, rows } = compliance(constraints, entries, new Map(classes.map((c) => [c.id, c.class_teacher_id])))
  return (
    <Badge variant={percent === 100 ? "secondary" : "destructive"}>
      Rules followed {percent}% ({rows.filter((r) => r.bad === 0).length}/{rows.length})
    </Badge>
  )
}

export function ConstraintCheck({ timetable, entries }: { timetable: Timetable | undefined; entries: TimetableEntry[] }) {
  const { data: constraints = [] } = useConstraints(true)
  const { data: classes = [] } = useClasses()
  if (!timetable || entries.length === 0) return null
  const newer = constraints.filter((c) => new Date(c.created_at) > new Date(timetable.created_at))
  const hard = constraints.filter((c) => c.severity === "hard")
  const { rows, percent, hardPercent } = compliance(constraints, entries, new Map(classes.map((c) => [c.id, c.class_teacher_id])))
  const broken = rows.filter((r) => r.bad > 0).length

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Rules check</h3>
      {newer.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-warning/40 bg-warning/10 p-2 text-xs">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <span>{newer.length} rule(s) were added after this timetable was made. Generate a new one to apply them.</span>
        </div>
      )}
      {constraints.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold tabular-nums">{percent}%</span>
            <span className="text-xs text-muted-foreground">of rules followed · must-follow {hardPercent}%</span>
          </div>
          <Progress value={percent} className="h-2" />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {constraints.length === 0 ? "No active rules." : broken === 0 ? `All ${constraints.length} active rules are followed (${hard.length} must-follow).` : `${broken} of ${constraints.length} rules are not followed here.`}
      </p>
      <ul className="space-y-1.5">
        {rows.map(({ c, bad }) => (
          <li key={c.id} className="flex gap-2 text-xs">
            {bad === 0 ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> : <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />}
            <span>
              {c.description ?? c.raw_text}
              {bad > 0 && <span className="text-destructive"> ({bad} lesson{bad > 1 ? "s" : ""} break it{c.severity === "soft" ? " - nice to have" : ""})</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
