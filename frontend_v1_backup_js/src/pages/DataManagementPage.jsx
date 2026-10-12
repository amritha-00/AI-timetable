import { useEffect, useState } from 'react'
import { classesApi, requirementsApi, roomsApi, subjectsApi, teachersApi } from '../api/client'
import DataTable from '../components/DataTable'
import TeacherAllocationPanel from '../components/TeacherAllocationPanel'
import TeacherSubjectMatrix from '../components/TeacherSubjectMatrix'
import TeacherSubjectsModal from '../components/TeacherSubjectsModal'
import { Alert, Card } from '../components/ui'

const TABS = [
  { key: 'Teachers', icon: '👤', hint: 'Staff roster' },
  { key: 'Subjects', icon: '📘', hint: 'Curriculum' },
  { key: 'Classes', icon: '🏫', hint: 'Grade & section' },
  { key: 'Rooms', icon: '🚪', hint: 'Classrooms & labs' },
  { key: 'Requirements', icon: '📋', hint: 'Periods/week' },
  { key: 'Assignments', icon: '🔗', hint: 'Teacher × Subject' },
  { key: 'Allocation', icon: '🧑‍🏫', hint: 'Per-teacher workload' },
]

export default function DataManagementPage() {
  const [tab, setTab] = useState('Teachers')
  const [teachers, setTeachers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [classes, setClasses] = useState([])
  const [rooms, setRooms] = useState([])
  const [requirements, setRequirements] = useState([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [subjectModalTeacher, setSubjectModalTeacher] = useState(null)

  const reloadAll = () => {
    Promise.all([teachersApi.list(), subjectsApi.list(), classesApi.list(), roomsApi.list(), requirementsApi.list()])
      .then(([t, s, c, r, req]) => {
        setTeachers(t)
        setSubjects(s)
        setClasses(c)
        setRooms(r)
        setRequirements(req)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { reloadAll() }, [])

  const subjectById = Object.fromEntries(subjects.map((s) => [s.id, s.name]))
  const classById = Object.fromEntries(classes.map((c) => [c.id, c.display_name]))

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Data Management</h1>
      <p className="text-sm text-slate-500 mb-4">
        Manage the roster the solver and LLM constraint layer both draw from. Changes here take effect the next
        time you generate a timetable or parse a constraint sentence.
      </p>
      {error && <Alert kind="error" onDismiss={() => setError('')}>{error}</Alert>}

      <div className="flex flex-col md:flex-row gap-5 items-start">
        <nav className="w-full md:w-52 shrink-0 md:sticky md:top-20">
          <Card className="p-1.5">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-left transition-all duration-150 ${
                  tab === t.key
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="text-base leading-none">{t.icon}</span>
                <span className="flex-1">{t.key}</span>
              </button>
            ))}
          </Card>
        </nav>

        <div className="flex-1 min-w-0 w-full">
          <Card className="p-5" key={tab}>
            <div className="animate-fade-in">
        {tab === 'Teachers' && (
          <DataTable
            title="Teachers"
            columns={[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'email', label: 'Email', type: 'text' },
              { key: 'phone', label: 'Phone', type: 'text' },
              { key: 'max_periods_per_day', label: 'Max periods/day', type: 'number', default: 6 },
              { key: 'is_active', label: 'Active', type: 'checkbox', default: true, checkboxLabel: 'Active' },
            ]}
            rows={teachers}
            loading={loading}
            onCreate={async (v) => { await teachersApi.create(v); reloadAll() }}
            onUpdate={async (id, v) => { await teachersApi.update(id, v); reloadAll() }}
            onDelete={async (id) => { await teachersApi.remove(id); reloadAll() }}
            extraAction={(row) => (
              <button
                onClick={() => setSubjectModalTeacher(row)}
                className="text-slate-600 hover:underline text-xs font-medium mr-3"
              >
                Subjects
              </button>
            )}
          />
        )}

        {tab === 'Subjects' && (
          <DataTable
            title="Subjects"
            columns={[
              { key: 'name', label: 'Name', type: 'text' },
              { key: 'code', label: 'Code', type: 'text' },
              { key: 'is_lab', label: 'Lab subject', type: 'checkbox', checkboxLabel: 'Requires a lab room' },
            ]}
            rows={subjects}
            loading={loading}
            onCreate={async (v) => { await subjectsApi.create(v); reloadAll() }}
            onUpdate={async (id, v) => { await subjectsApi.update(id, v); reloadAll() }}
            onDelete={async (id) => { await subjectsApi.remove(id); reloadAll() }}
          />
        )}

        {tab === 'Classes' && (
          <DataTable
            title="Classes"
            addLabel="Add Class"
            columns={[
              { key: 'grade', label: 'Grade', type: 'number' },
              { key: 'section', label: 'Section', type: 'text' },
              { key: 'strength', label: 'Strength', type: 'number', default: 40 },
              {
                key: 'class_teacher_id',
                label: 'Class Teacher',
                type: 'select',
                nullable: true,
                noneLabel: 'No class teacher assigned',
                options: teachers.map((t) => ({ value: t.id, label: t.name })),
                render: (row) => row.class_teacher_name || <span className="text-slate-400">— none —</span>,
              },
            ]}
            rows={classes}
            loading={loading}
            onCreate={async (v) => { await classesApi.create(v); reloadAll() }}
            onUpdate={async (id, v) => { await classesApi.update(id, v); reloadAll() }}
            onDelete={async (id) => { await classesApi.remove(id); reloadAll() }}
          />
        )}

        {tab === 'Rooms' && (
          <DataTable
            title="Rooms"
            columns={[
              { key: 'name', label: 'Name', type: 'text' },
              {
                key: 'room_type',
                label: 'Type',
                type: 'select',
                default: 'classroom',
                options: [
                  { value: 'classroom', label: 'Classroom' },
                  { value: 'lab', label: 'Lab' },
                  { value: 'auditorium', label: 'Auditorium' },
                  { value: 'sports', label: 'Sports' },
                ],
              },
              { key: 'capacity', label: 'Capacity', type: 'number', default: 40 },
            ]}
            rows={rooms}
            loading={loading}
            onCreate={async (v) => { await roomsApi.create(v); reloadAll() }}
            onUpdate={async (id, v) => { await roomsApi.update(id, v); reloadAll() }}
            onDelete={async (id) => { await roomsApi.remove(id); reloadAll() }}
          />
        )}

        {tab === 'Requirements' && (
          <DataTable
            title="Requirements"
            addLabel="Add Requirement"
            columns={[
              {
                key: 'class_id', label: 'Class', type: 'select',
                options: classes.map((c) => ({ value: c.id, label: c.display_name })),
                render: (row) => classById[row.class_id] || row.class_id,
              },
              {
                key: 'subject_id', label: 'Subject', type: 'select',
                options: subjects.map((s) => ({ value: s.id, label: s.name })),
                render: (row) => subjectById[row.subject_id] || row.subject_id,
              },
              { key: 'periods_per_week', label: 'Periods/week', type: 'number', default: 1 },
              {
                key: 'teacher_id',
                label: 'Teacher',
                type: 'select',
                nullable: true,
                noneLabel: 'Any qualified teacher (solver picks)',
                // Only offer teachers actually qualified for whichever subject is
                // selected on this row - pinning an unqualified teacher would just
                // make the solver infeasible, so the UI doesn't even offer it.
                options: (row) => {
                  const subjectId = Number(row?.subject_id)
                  if (!subjectId) return []
                  return teachers
                    .filter((t) => t.subject_ids.includes(subjectId))
                    .map((t) => ({ value: t.id, label: t.name }))
                },
                render: (row) => row.teacher_name || <span className="text-slate-400">any qualified</span>,
              },
            ]}
            rows={requirements}
            loading={loading}
            onCreate={async (v) => { await requirementsApi.create(v); reloadAll() }}
            onUpdate={async (id, v) => {
              await requirementsApi.update(id, { periods_per_week: v.periods_per_week, teacher_id: v.teacher_id })
              reloadAll()
            }}
            onDelete={async (id) => { await requirementsApi.remove(id); reloadAll() }}
          />
        )}

        {tab === 'Assignments' && (
          <TeacherSubjectMatrix teachers={teachers} subjects={subjects} loading={loading} onChanged={reloadAll} />
        )}

        {tab === 'Allocation' && (
          <TeacherAllocationPanel
            teachers={teachers}
            subjects={subjects}
            classes={classes}
            requirements={requirements}
            onChanged={reloadAll}
          />
        )}
            </div>
          </Card>
        </div>
      </div>

      <TeacherSubjectsModal
        teacher={subjectModalTeacher}
        subjects={subjects}
        onClose={() => { setSubjectModalTeacher(null); reloadAll() }}
      />
    </div>
  )
}
