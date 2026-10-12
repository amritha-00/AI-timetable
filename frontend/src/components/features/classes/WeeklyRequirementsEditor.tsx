import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTeachers } from "@/hooks/useTeachers"
import { Progress } from "@/components/ui/progress"
import { useCreateRequirement, useDeleteRequirement, useRequirements, useUpdateRequirement } from "@/hooks/useRequirements"
import { cn } from "@/lib/utils"
import type { Subject } from "@/types"

interface WeeklyRequirementsEditorProps {
  classId: number
  subjects: Subject[]
  totalSlots: number
}

/**
 * Per-subject periods-per-week editor for one class, with a running total
 * against the school's total weekly teaching slots (days x periods) that
 * turns red once it's over capacity - spec: "Class form includes setting
 * periods-per-week for each subject, with a running total shown against
 * the total weekly slots available, turning red if it exceeds capacity."
 */
export function WeeklyRequirementsEditor({ classId, subjects, totalSlots }: WeeklyRequirementsEditorProps) {
  const { data: requirements = [] } = useRequirements(classId)
  const createRequirement = useCreateRequirement()
  const updateRequirement = useUpdateRequirement()
  const deleteRequirement = useDeleteRequirement()

  const { data: teachers = [] } = useTeachers()
  const [values, setValues] = useState<Record<number, number>>({})

  useEffect(() => {
    const next: Record<number, number> = {}
    for (const s of subjects) {
      const req = requirements.find((r) => r.subject_id === s.id)
      next[s.id] = req?.periods_per_week ?? 0
    }
    setValues(next)
  }, [requirements, subjects])

  const total = Object.values(values).reduce((sum, v) => sum + v, 0)
  const overCapacity = total > totalSlots
  const percent = totalSlots > 0 ? Math.min(100, (total / totalSlots) * 100) : 0

  const commit = (subjectId: number, next: number) => {
    const existing = requirements.find((r) => r.subject_id === subjectId)
    if (next <= 0) {
      if (existing) deleteRequirement.mutate(existing.id)
      return
    }
    if (existing) {
      if (existing.periods_per_week !== next) {
        updateRequirement.mutate({ id: existing.id, input: { periods_per_week: next } })
      }
    } else {
      createRequirement.mutate({ class_id: classId, subject_id: subjectId, periods_per_week: next, teacher_id: null })
    }
  }

  const setTeacher = (subjectId: number, value: string) => {
    const existing = requirements.find((r) => r.subject_id === subjectId)
    const teacher_id = value === "any" ? null : Number(value)
    if (existing) updateRequirement.mutate({ id: existing.id, input: { teacher_id } })
    else if (teacher_id !== null)
      createRequirement.mutate({ class_id: classId, subject_id: subjectId, periods_per_week: values[subjectId] || 1, teacher_id })
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="font-medium">Weekly periods used</span>
          <span className={cn("tabular-nums font-medium", overCapacity ? "text-destructive" : "text-muted-foreground")}>
            {total} / {totalSlots}
          </span>
        </div>
        <Progress value={percent} className={cn("h-2", overCapacity && "[&>div]:bg-destructive")} />
        {overCapacity && (
          <p className="flex items-center gap-1.5 text-xs text-destructive mt-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> This exceeds the {totalSlots} periods available each week.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border divide-y divide-border max-h-72 overflow-y-auto">
        {subjects.length === 0 ? (
          <p className="p-3 text-sm text-muted-foreground">Add subjects first to set periods per week.</p>
        ) : (
          subjects.map((subject) => (
            <div key={subject.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-sm truncate flex-1 min-w-0">{subject.name}</span>
              <Select
                value={String(requirements.find((r) => r.subject_id === subject.id)?.teacher_id ?? "any")}
                onValueChange={(v) => setTeacher(subject.id, v)}
              >
                <SelectTrigger className="h-8 w-36" aria-label={`${subject.name} teacher`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any teacher</SelectItem>
                  {teachers.filter((t) => t.subject_ids.includes(subject.id)).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                  {!teachers.some((t) => t.subject_ids.includes(subject.id)) && (
                    <SelectItem value="none-available" disabled>No teacher teaches this subject yet</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                max={totalSlots}
                value={values[subject.id] ?? 0}
                onChange={(e) => setValues((prev) => ({ ...prev, [subject.id]: Number(e.target.value) || 0 }))}
                onBlur={(e) => commit(subject.id, Number(e.target.value) || 0)}
                className="w-16 h-8 text-right"
                aria-label={`${subject.name} periods per week`}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
