import { useState } from "react"
import { DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { Day, Period, TimetableEntry } from "@/types"

export type ViewMode = "class" | "teacher" | "room"

const hue = (id: number) => (id * 47) % 360
const cellColor = (subjectId: number) => ({
  backgroundColor: `hsl(${hue(subjectId)} 70% 50% / 0.16)`,
  borderColor: `hsl(${hue(subjectId)} 70% 45% / 0.5)`,
})

interface Props {
  entries: TimetableEntry[] // already filtered to what this grid shows
  allEntries: TimetableEntry[] // whole school, used to validate drops
  days: Day[]
  periods: Period[]
  mode: ViewMode
  onMove?: (entry: TimetableEntry, dayId: number, periodId: number) => void
  readOnly?: boolean
}

/** Why the entry can't go to this slot, or null if it can (server re-checks rooms). */
function conflictReason(entry: TimetableEntry, dayId: number, periodId: number, all: TimetableEntry[]): string | null {
  const here = all.filter((e) => e.day_id === dayId && e.period_id === periodId && e.id !== entry.id)
  if (here.some((e) => e.class_id === entry.class_id)) return `${entry.class_name} already has a lesson then.`
  if (here.some((e) => e.teacher_id === entry.teacher_id)) return `${entry.teacher_name} is already teaching another class then.`
  return null
}

function Slot({ dayId, periodId, state, children }: { dayId: number; periodId: number; state: "idle" | "ok" | "bad"; children?: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${dayId}-${periodId}` })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-16 rounded-md border border-dashed border-border p-1 transition-colors",
        state === "ok" && "border-success bg-success/10",
        state === "bad" && "border-destructive bg-destructive/10",
        isOver && state !== "idle" && "ring-2 ring-offset-1",
        isOver && state === "ok" && "ring-success",
        isOver && state === "bad" && "ring-destructive",
      )}
    >
      {children}
    </div>
  )
}

function Lesson({ entry, mode, dim, hot, onHover, readOnly }: { readOnly?: boolean; entry: TimetableEntry; mode: ViewMode; dim: boolean; hot: boolean; onHover: (t: number | null) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.id, disabled: readOnly })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onMouseEnter={() => onHover(entry.teacher_id)}
      onMouseLeave={() => onHover(null)}
      style={cellColor(entry.subject_id)}
      className={cn(
        "h-full rounded border px-1.5 py-1 text-xs leading-tight select-none",
        !readOnly && "cursor-grab touch-none",
        isDragging && "opacity-30",
        dim && "opacity-30",
        hot && "ring-2 ring-primary",
      )}
    >
      <div className="font-medium truncate">{entry.subject_name}</div>
      <div className="truncate text-muted-foreground">
        {mode === "teacher" ? entry.class_name : entry.teacher_name}
        {mode === "room" ? ` · ${entry.class_name}` : ""}
      </div>
      {mode !== "room" && <div className="truncate text-muted-foreground">{entry.room_name}</div>}
    </div>
  )
}

export function TimetableGrid({ entries, allEntries, days, periods, mode, onMove, readOnly }: Props) {
  const [dragging, setDragging] = useState<TimetableEntry | null>(null)
  const [hoverTeacher, setHoverTeacher] = useState<number | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const at = (d: number, p: number) => entries.filter((e) => e.day_id === d && e.period_id === p)
  const stateFor = (d: number, p: number): "idle" | "ok" | "bad" => {
    if (!dragging) return "idle"
    if (dragging.day_id === d && dragging.period_id === p) return "idle"
    return conflictReason(dragging, d, p, allEntries) ? "bad" : "ok"
  }

  const onStart = (e: DragStartEvent) => setDragging(entries.find((x) => x.id === e.active.id) ?? null)
  const onEnd = (e: DragEndEvent) => {
    const entry = dragging
    setDragging(null)
    if (!entry || !e.over) return
    const [d, p] = String(e.over.id).split("-").map(Number)
    if (d === entry.day_id && p === entry.period_id) return
    const reason = conflictReason(entry, d, p, allEntries)
    if (reason) toast.error(`Can't move it there. ${reason}`)
    else onMove?.(entry, d, p)
  }

  return (
    <DndContext sensors={sensors} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setDragging(null)}>
      <div className="overflow-x-auto">
        <div className="grid min-w-[42rem] gap-1.5" style={{ gridTemplateColumns: `5.5rem repeat(${days.length}, minmax(0, 1fr))` }}>
          <div />
          {days.map((d) => <div key={d.id} className="pb-1 text-center text-xs font-semibold text-muted-foreground">{d.name}</div>)}
          {periods.map((p) => (
            <div key={p.id} className="contents">
              <div className="pr-1 pt-1 text-right text-[11px] text-muted-foreground">
                <div className="font-medium">{p.is_break ? p.label ?? "Break" : `Period ${p.period_number}`}</div>
                <div className="tabular-nums">{p.start_time.slice(0, 5)}</div>
              </div>
              {days.map((d) =>
                p.is_break ? (
                  <div key={d.id} className="rounded-md bg-muted/60 py-1 text-center text-[11px] text-muted-foreground">{p.label ?? "Break"}</div>
                ) : (
                  <Slot key={d.id} dayId={d.id} periodId={p.id} state={stateFor(d.id, p.id)}>
                    {at(d.id, p.id).map((e) => (
                      <Lesson key={e.id} entry={e} mode={mode} readOnly={readOnly} onHover={setHoverTeacher}
                        hot={hoverTeacher === e.teacher_id} dim={hoverTeacher !== null && hoverTeacher !== e.teacher_id} />
                    ))}
                  </Slot>
                ),
              )}
            </div>
          ))}
        </div>
      </div>
      <DragOverlay>
        {dragging && (
          <div style={cellColor(dragging.subject_id)} className="rounded border px-1.5 py-1 text-xs shadow-lg">
            <div className="font-medium">{dragging.subject_name}</div>
            <div className="text-muted-foreground">{dragging.teacher_name}</div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
