import { useMemo, useState } from 'react'

// A fixed, consistent palette so the same subject always gets the same
// color across the whole app (and across re-renders/re-fetches, since it's
// keyed off subject_id rather than array position).
const PALETTE = [
  'bg-sky-100 text-sky-800 border-sky-300',
  'bg-emerald-100 text-emerald-800 border-emerald-300',
  'bg-amber-100 text-amber-800 border-amber-300',
  'bg-rose-100 text-rose-800 border-rose-300',
  'bg-violet-100 text-violet-800 border-violet-300',
  'bg-cyan-100 text-cyan-800 border-cyan-300',
  'bg-lime-100 text-lime-800 border-lime-300',
  'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300',
  'bg-orange-100 text-orange-800 border-orange-300',
  'bg-teal-100 text-teal-800 border-teal-300',
]

function colorFor(subjectId) {
  return PALETTE[subjectId % PALETTE.length]
}

/**
 * Day x Period grid. `secondaryLabel(entry)` controls what shows under the
 * subject name - the class view shows the teacher, the teacher view shows
 * the class - so the same component serves both.
 */
export default function TimetableGrid({ days, periods, entries, secondaryLabel, onMove, readOnly = false }) {
  const [dragOverKey, setDragOverKey] = useState(null)

  const bySlot = useMemo(() => {
    const map = new Map()
    for (const e of entries) map.set(`${e.day_id}:${e.period_id}`, e)
    return map
  }, [entries])

  const handleDrop = (e, dayId, periodId) => {
    e.preventDefault()
    setDragOverKey(null)
    const entryId = Number(e.dataTransfer.getData('text/entry-id'))
    if (!entryId) return
    onMove?.(entryId, dayId, periodId)
  }

  return (
    <div className="animate-fade-in overflow-x-auto grid-scroll rounded-lg border border-slate-200">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-slate-50 border-b border-r border-slate-200 px-3 py-2 text-slate-500 font-medium w-28">
              Period
            </th>
            {days.map((d) => (
              <th key={d.id} className="bg-slate-50 border-b border-slate-200 px-3 py-2 text-slate-600 font-medium min-w-[140px]">
                {d.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr key={p.id}>
              <td className="sticky left-0 bg-white border-r border-b border-slate-100 px-3 py-2 text-slate-500 font-medium">
                P{p.period_number}
                <div className="text-[10px] text-slate-400">{p.start_time?.slice(0, 5)}</div>
              </td>
              {days.map((d) => {
                const key = `${d.id}:${p.id}`
                const entry = bySlot.get(key)
                const isDragOver = dragOverKey === key
                return (
                  <td
                    key={key}
                    className={`border-b border-slate-100 p-1 align-top h-16 transition-colors duration-150 ${isDragOver ? 'bg-brand-50 ring-2 ring-brand-300 ring-inset' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setDragOverKey(key) }}
                    onDragLeave={() => setDragOverKey((k) => (k === key ? null : k))}
                    onDrop={(e) => handleDrop(e, d.id, p.id)}
                  >
                    {entry ? (
                      <div
                        key={entry.id}
                        draggable={!readOnly}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/entry-id', String(entry.id))
                          e.currentTarget.classList.add('opacity-40')
                        }}
                        onDragEnd={(e) => e.currentTarget.classList.remove('opacity-40')}
                        className={`animate-scale-in rounded-md border px-2 py-1.5 h-full transition-all duration-150 ${readOnly ? 'cursor-default' : 'cursor-grab hover:shadow-md hover:-translate-y-0.5 active:cursor-grabbing'} ${colorFor(entry.subject_id)}`}
                        title={`${entry.subject_name} - ${entry.teacher_name} - ${entry.room_name}`}
                      >
                        <div className="font-semibold truncate">{entry.subject_name}</div>
                        <div className="truncate opacity-80">{secondaryLabel(entry)}</div>
                        <div className="truncate opacity-60">{entry.room_name}</div>
                      </div>
                    ) : (
                      <div className="h-full rounded-md transition-colors duration-150 hover:bg-slate-50" />
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
