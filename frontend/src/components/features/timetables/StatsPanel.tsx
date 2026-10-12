import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { Room, TimetableEntry } from "@/types"

export function StatsPanel({ entries, rooms, slotsPerWeek }: { entries: TimetableEntry[]; rooms: Room[]; slotsPerWeek: number }) {
  const byTeacher = new Map<string, number>()
  for (const e of entries) byTeacher.set(e.teacher_name, (byTeacher.get(e.teacher_name) ?? 0) + 1)
  const load = [...byTeacher].map(([name, lessons]) => ({ name: name.split(" ")[0], full: name, lessons })).sort((a, b) => b.lessons - a.lessons)
  const classes = new Set(entries.map((e) => e.class_id)).size
  const roomsUsed = new Set(entries.map((e) => e.room_id)).size
  const utilisation = rooms.length && slotsPerWeek ? Math.round((entries.length / (rooms.length * slotsPerWeek)) * 100) : 0

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 text-center">
        {[
          ["Lessons", entries.length],
          ["Classes", classes],
          ["Teachers", byTeacher.size],
          ["Rooms used", `${roomsUsed}/${rooms.length}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border border-border bg-card p-2">
            <div className="text-lg font-semibold tabular-nums">{v}</div>
            <div className="text-xs text-muted-foreground">{k}</div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Rooms are in use {utilisation}% of the time across the week.</p>
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Lessons per teacher</h3>
        <div style={{ height: Math.max(160, load.length * 22) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={load} layout="vertical" margin={{ left: 0, right: 8 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={64} tick={{ fontSize: 11 }} interval={0} />
              <Tooltip formatter={(v) => [`${v} lessons`, ""]} labelFormatter={(_, p) => p?.[0]?.payload.full} />
              <Bar dataKey="lessons" fill="var(--primary)" radius={3} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
