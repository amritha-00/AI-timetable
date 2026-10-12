import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { CalendarDays, Download, Printer, Undo2 } from "lucide-react"
import { toast } from "sonner"
import { ConstraintCheck } from "@/components/features/timetables/ConstraintCheck"
import { StatsPanel } from "@/components/features/timetables/StatsPanel"
import { TimetableGrid, type ViewMode } from "@/components/features/timetables/TimetableGrid"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useClasses } from "@/hooks/useClasses"
import { useDays, usePeriods } from "@/hooks/usePeriods"
import { useRooms } from "@/hooks/useRooms"
import { useTeachers } from "@/hooks/useTeachers"
import { useAllEntries, useMoveTimetableEntry, useTimetables } from "@/hooks/useTimetables"
import { timetablesApi } from "@/lib/api/timetables"
import type { TimetableEntry } from "@/types"

const PUBLISHED_KEY = "published_timetable"
const readPublished = () => {
  try { return Number(localStorage.getItem(PUBLISHED_KEY)) || null } catch { return null }
}

export default function TimetablesPage() {
  const { data: timetables = [], isLoading } = useTimetables()
  const done = useMemo(() => timetables.filter((t) => t.status === "completed").sort((a, b) => b.id - a.id), [timetables])
  const [timetableId, setTimetableId] = useState<number>()
  const [mode, setMode] = useState<ViewMode>("class")
  const [pick, setPick] = useState<string>("")
  const [published, setPublished] = useState<number | null>(readPublished)
  const [undo, setUndo] = useState<{ entry: TimetableEntry }[]>([])

  useEffect(() => {
    if (timetableId === undefined && done.length) setTimetableId(published && done.some((t) => t.id === published) ? published : done[0].id)
  }, [done, timetableId, published])

  const { data: all = [], isLoading: loadingEntries } = useAllEntries(timetableId)
  const { data: classes = [] } = useClasses()
  const { data: teachers = [] } = useTeachers()
  const { data: rooms = [] } = useRooms()
  const { data: days = [] } = useDays()
  const { data: periods = [] } = usePeriods()
  const qc = useQueryClient()
  const move = useMoveTimetableEntry(timetableId ?? 0)

  const options = useMemo(
    () =>
      mode === "class" ? classes.map((c) => ({ id: c.id, label: c.display_name }))
      : mode === "teacher" ? teachers.map((t) => ({ id: t.id, label: t.name }))
      : rooms.map((r) => ({ id: r.id, label: r.name })),
    [mode, classes, teachers, rooms],
  )
  useEffect(() => { if (options.length) setPick(String(options[0].id)) }, [mode, options.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = all.filter((e) => Number(pick) === (mode === "class" ? e.class_id : mode === "teacher" ? e.teacher_id : e.room_id))
  const sortedPeriods = [...periods].sort((a, b) => a.period_number - b.period_number)
  const slotsPerWeek = days.length * periods.filter((p) => !p.is_break).length

  const doMove = (entry: TimetableEntry, dayId: number, periodId: number) =>
    move.mutate({ entryId: entry.id, dayId, periodId }, {
      onSuccess: () => { setUndo((u) => [...u, { entry }]); toast.success("Lesson moved") },
    })

  const doUndo = async () => {
    const last = undo[undo.length - 1]
    if (!last || !timetableId) return
    try {
      await timetablesApi.moveEntry(timetableId, last.entry.id, last.entry.day_id, last.entry.period_id)
      setUndo((u) => u.slice(0, -1))
      qc.invalidateQueries({ queryKey: ["timetables"] })
      toast.success("Move undone")
    } catch { toast.error("Couldn't undo - that slot is taken now.") }
  }

  const publish = () => {
    if (!timetableId) return
    try { localStorage.setItem(PUBLISHED_KEY, String(timetableId)) } catch { /* ignore */ }
    setPublished(timetableId)
    toast.success("Marked as the published timetable")
  }

  if (!isLoading && done.length === 0)
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Timetables</h1>
        <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-3">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No timetable yet. Generate one to see it here.</p>
          <Button asChild><Link to="/generate">Generate a timetable</Link></Button>
        </div>
      </div>
    )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-2xl font-semibold tracking-tight">Timetables</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(timetableId ?? "")} onValueChange={(v) => { setTimetableId(Number(v)); setUndo([]) }}>
            <SelectTrigger className="w-64" aria-label="Version"><SelectValue placeholder="Choose a version" /></SelectTrigger>
            <SelectContent>
              {done.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.name} · {new Date(t.created_at).toLocaleDateString()}{t.id === published ? " (published)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {timetableId === published ? <Badge>Published</Badge> : <Button variant="outline" onClick={publish}>Publish</Button>}
          <Button variant="outline" onClick={doUndo} disabled={undo.length === 0}><Undo2 className="h-4 w-4" /> Undo</Button>
          <Button asChild variant="outline"><a href={timetablesApi.exportUrl(timetableId ?? 0, "excel")}><Download className="h-4 w-4" /> Excel</a></Button>
          <Button asChild variant="outline"><a href={timetablesApi.exportUrl(timetableId ?? 0, "pdf")}><Download className="h-4 w-4" /> PDF</a></Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> Print</Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Tabs value={mode} onValueChange={(v) => setMode(v as ViewMode)}>
          <TabsList>
            <TabsTrigger value="class">Class</TabsTrigger>
            <TabsTrigger value="teacher">Teacher</TabsTrigger>
            <TabsTrigger value="room">Room</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={pick} onValueChange={setPick}>
          <SelectTrigger className="w-56" aria-label={`Choose a ${mode}`}><SelectValue /></SelectTrigger>
          <SelectContent>{options.map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.label}</SelectItem>)}</SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">Drag a lesson to another slot. Green spots are free, red ones would clash. Hover a lesson to highlight its teacher.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="rounded-xl border border-border bg-card p-3">
          {loadingEntries ? <p className="p-6 text-sm text-muted-foreground">Loading timetable...</p> : (
            <TimetableGrid entries={shown} allEntries={all} days={days} periods={sortedPeriods} mode={mode} onMove={doMove} />
          )}
        </div>
        <aside className="space-y-6 print:hidden">
          <ConstraintCheck timetable={done.find((t) => t.id === timetableId)} entries={all} />
          <StatsPanel entries={all} rooms={rooms} slotsPerWeek={slotsPerWeek} />
        </aside>
      </div>
    </div>
  )
}
