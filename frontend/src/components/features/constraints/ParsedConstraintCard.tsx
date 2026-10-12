import { useState } from "react"
import { Check, Pencil, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDays, usePeriods } from "@/hooks/usePeriods"
import { useTeachers } from "@/hooks/useTeachers"
import { cn } from "@/lib/utils"
import type { ConfirmConstraintInput, ConstraintSeverity, ConstraintType, ParseResponse } from "@/types"
import { MiniWeekGrid, selectionFromPayload } from "./MiniWeekGrid"

export const TYPE_LABELS: Record<ConstraintType, string> = {
  teacher_unavailable: "Teacher unavailable",
  teacher_preferred_slot: "Teacher preference",
  subject_time_preference: "Subject timing",
  max_periods_per_day: "Daily limit",
  no_consecutive: "No back-to-back",
  room_requirement: "Room requirement",
  class_teacher_period: "Class teacher timing",
  class_subject_assignment: "Teacher and periods for a class",
}

interface Props {
  parsed: ParseResponse
  onConfirm: (input: ConfirmConstraintInput) => void
  onDiscard: () => void
  disabled?: boolean
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "rounded-md border px-2 py-1 text-xs transition-colors",
        on ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}

export function ParsedConstraintCard({ parsed, onConfirm, onDiscard, disabled }: Props) {
  const { data: days = [] } = useDays()
  const { data: allPeriods = [] } = usePeriods()
  const { data: teachers = [] } = useTeachers()
  const periods = allPeriods.filter((p) => !p.is_break)

  const payload = parsed.payload ?? {}
  const initial = selectionFromPayload(payload)
  const [editing, setEditing] = useState(false)
  const [severity, setSeverity] = useState<ConstraintSeverity>(parsed.severity ?? "hard")
  const [weight, setWeight] = useState(parsed.weight ?? 1)
  const [dayIds, setDayIds] = useState<number[]>(initial.dayIds)
  const [periodNums, setPeriodNums] = useState<number[]>(initial.periods)

  const teacher = teachers.find((t) => t.id === payload.teacher_id)
  const hasSlots = "periods" in payload || "day_ids" in payload
  const flip = (list: number[], v: number) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const confirm = () =>
    onConfirm({
      constraint_type: parsed.constraint_type!,
      raw_text: parsed.raw_text,
      payload: hasSlots ? { ...payload, ...(dayIds.length ? { day_ids: dayIds } : {}), periods: periodNums } : payload,
      severity,
      weight: severity === "hard" ? 1 : weight,
    })

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-3 animate-in fade-in slide-in-from-bottom-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{TYPE_LABELS[parsed.constraint_type!]}</Badge>
        {editing ? (
          <Select value={severity} onValueChange={(v) => setSeverity(v as ConstraintSeverity)}>
            <SelectTrigger className="h-7 w-32" aria-label="Rule strength"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="hard">Must follow</SelectItem>
              <SelectItem value="soft">Nice to have</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <Badge variant={severity === "hard" ? "destructive" : "outline"}>{severity === "hard" ? "Must follow" : "Nice to have"}</Badge>
        )}
        {editing && severity === "soft" && (
          <Select value={String(weight)} onValueChange={(v) => setWeight(Number(v))}>
            <SelectTrigger className="h-7 w-28" aria-label="Importance"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((w) => <SelectItem key={w} value={String(w)}>Importance {w}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      <p className="text-sm font-medium">{parsed.human_description}</p>
      {teacher && <p className="text-xs text-muted-foreground">Teacher: {teacher.name}</p>}

      {hasSlots && (
        <div className="space-y-2">
          <MiniWeekGrid selection={{ dayIds, periods: periodNums }} tone={parsed.constraint_type === "teacher_unavailable" ? "destructive" : "primary"} />
          {editing && (
            <div className="space-y-1.5">
              <div className="flex flex-wrap gap-1">
                {days.map((d) => <Toggle key={d.id} on={dayIds.includes(d.id)} onClick={() => setDayIds(flip(dayIds, d.id))}>{d.name.slice(0, 3)}</Toggle>)}
              </div>
              <div className="flex flex-wrap gap-1">
                {periods.map((p) => <Toggle key={p.id} on={periodNums.includes(p.period_number)} onClick={() => setPeriodNums(flip(periodNums, p.period_number))}>P{p.period_number}</Toggle>)}
              </div>
              <p className="text-[11px] text-muted-foreground">Nothing selected means every day / every period.</p>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={confirm} disabled={disabled}><Check className="h-4 w-4" /> {editing ? "Save changes" : "Confirm"}</Button>
        {!editing && <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /> Edit</Button>}
        <Button size="sm" variant="ghost" onClick={onDiscard}><X className="h-4 w-4" /> Discard</Button>
      </div>
    </div>
  )
}
