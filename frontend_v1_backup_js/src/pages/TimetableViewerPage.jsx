import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { classesApi, daysApi, periodsApi, teachersApi, timetablesApi } from '../api/client'
import TimetableGrid from '../components/TimetableGrid'
import { Alert, Badge, Button, Card, LoadingState, Select } from '../components/ui'

export default function TimetableViewerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [timetables, setTimetables] = useState([])
  const [timetableId, setTimetableId] = useState(searchParams.get('timetable') || '')
  const [viewMode, setViewMode] = useState('class') // 'class' | 'teacher'
  const [classes, setClasses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [days, setDays] = useState([])
  const [periods, setPeriods] = useState([])
  const [entries, setEntries] = useState([])
  const [pageLoading, setPageLoading] = useState(true)
  const [gridLoading, setGridLoading] = useState(true)
  const [error, setError] = useState('')
  const [moveError, setMoveError] = useState('')

  useEffect(() => {
    Promise.all([
      timetablesApi.list().then((all) => {
        const completed = all.filter((t) => t.status === 'completed')
        setTimetables(completed)
        // Auto-select a timetable if none is chosen yet (e.g. landing on this
        // page directly rather than via "View Timetable" from Generate, which
        // sets ?timetable= itself) - otherwise the dropdown shows one selected
        // while no entries ever load underneath it.
        setTimetableId((current) => current || (completed[0] ? String(completed[0].id) : ''))
      }),
      classesApi.list().then(setClasses),
      teachersApi.list().then(setTeachers),
      daysApi.list().then(setDays),
      // The grid only shows teaching periods - the lunch break (is_break=true)
      // is a real row in the DB (so it can have its own start/end time) but
      // isn't a schedulable slot, so it's excluded here rather than rendered
      // as a confusing always-empty row.
      periodsApi.list().then((all) => setPeriods(all.filter((p) => !p.is_break))),
    ]).finally(() => setPageLoading(false))
  }, [])

  useEffect(() => {
    if (classes.length && !selectedClass) setSelectedClass(String(classes[0].id))
    if (teachers.length && !selectedTeacher) setSelectedTeacher(String(teachers[0].id))
  }, [classes, teachers])

  const loadEntries = () => {
    if (!timetableId) return
    const filters = viewMode === 'class' ? { class_id: selectedClass } : { teacher_id: selectedTeacher }
    if (viewMode === 'class' && !selectedClass) return
    if (viewMode === 'teacher' && !selectedTeacher) return
    setGridLoading(true)
    timetablesApi
      .entries(timetableId, filters)
      .then(setEntries)
      .catch((err) => setError(err.message))
      .finally(() => setGridLoading(false))
  }

  useEffect(() => { loadEntries() }, [timetableId, viewMode, selectedClass, selectedTeacher])

  useEffect(() => {
    if (timetableId) setSearchParams({ timetable: timetableId })
  }, [timetableId])

  const handleMove = async (entryId, dayId, periodId) => {
    setMoveError('')
    try {
      await timetablesApi.moveEntry(timetableId, entryId, dayId, periodId)
      loadEntries()
    } catch (err) {
      setMoveError(err.message)
    }
  }

  const secondaryLabel = useMemo(
    () => (viewMode === 'class' ? (e) => e.teacher_name : (e) => e.class_name),
    [viewMode],
  )

  if (pageLoading) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-slate-800 mb-2">Timetable Viewer</h1>
        <LoadingState label="Loading timetables…" />
      </div>
    )
  }

  if (timetables.length === 0) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-slate-800 mb-2">Timetable Viewer</h1>
        <Alert kind="info">No completed timetables yet. Go to Generate to create one.</Alert>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-slate-800">Timetable Viewer</h1>
        <div className="flex gap-2">
          <a href={timetableId ? timetablesApi.exportUrl(timetableId, 'excel') : '#'}>
            <Button variant="secondary" disabled={!timetableId}>⬇ Excel</Button>
          </a>
          <a href={timetableId ? timetablesApi.exportUrl(timetableId, 'pdf') : '#'}>
            <Button variant="secondary" disabled={!timetableId}>⬇ PDF</Button>
          </a>
        </div>
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Timetable</label>
            <Select value={timetableId} onChange={(e) => setTimetableId(e.target.value)} className="w-56">
              {timetables.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({new Date(t.created_at).toLocaleDateString()})</option>
              ))}
            </Select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">View</label>
            <div className="flex rounded-md border border-slate-300 overflow-hidden">
              {['class', 'teacher'].map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-3 py-1.5 text-sm capitalize transition-all duration-200 ${viewMode === m ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {m} view
                </button>
              ))}
            </div>
          </div>

          {viewMode === 'class' ? (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Class</label>
              <Select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)} className="w-40">
                {classes.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
              </Select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Teacher</label>
              <Select value={selectedTeacher} onChange={(e) => setSelectedTeacher(e.target.value)} className="w-48">
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
          )}
        </div>
      </Card>

      {error && <Alert kind="error" onDismiss={() => setError('')}>{error}</Alert>}
      {moveError && <Alert kind="error" onDismiss={() => setMoveError('')}>{moveError}</Alert>}

      <p className="text-xs text-slate-400 mb-2">Drag a class onto a different day/period to reschedule it manually - moves are re-checked against teacher, class, and room clashes.</p>

      {gridLoading ? (
        <LoadingState label="Loading schedule…" />
      ) : (
        <>
          <TimetableGrid days={days} periods={periods} entries={entries} secondaryLabel={secondaryLabel} onMove={handleMove} />

          <div className="flex flex-wrap gap-2 mt-4">
            {[...new Map(entries.map((e) => [e.subject_id, e.subject_name])).entries()].map(([id, name], i) => (
              <span key={id} className="stagger-item" style={{ animationDelay: `${i * 25}ms` }}>
                <Badge tone="slate">{name}</Badge>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
