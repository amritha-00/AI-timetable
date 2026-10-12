import { useMemo, useState } from 'react'
import { classesApi, requirementsApi } from '../api/client'
import { Alert, Badge, Button, Select } from './ui'

/**
 * Per-teacher view of everything that teacher is assigned to: which
 * class(es) they're the homeroom/class teacher of, and which specific
 * class+subject combinations they're pinned to teach (e.g. "Science for
 * Grade 1" and "Biology for Grade 10" for the same teacher). Both are
 * already stored (classes.class_teacher_id and
 * class_subject_requirements.teacher_id respectively) and editable
 * elsewhere (Classes tab, Requirements tab) - this page is the "pick a
 * teacher, see and manage everything they're assigned to" view, since
 * editing one requirement row at a time doesn't answer "what is this
 * teacher's full workload" at a glance.
 */
export default function TeacherAllocationPanel({ teachers, subjects, classes, requirements, onChanged }) {
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? '')
  const [newSubjectId, setNewSubjectId] = useState('')
  const [newClassId, setNewClassId] = useState('')
  const [newClassTeacherOf, setNewClassTeacherOf] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const teacher = teachers.find((t) => t.id === Number(teacherId))
  const subjectById = Object.fromEntries(subjects.map((s) => [s.id, s.name]))
  const classById = Object.fromEntries(classes.map((c) => [c.id, c.display_name]))

  const homeroomClasses = useMemo(
    () => classes.filter((c) => c.class_teacher_id === Number(teacherId)),
    [classes, teacherId],
  )
  const teachingAssignments = useMemo(
    () => requirements.filter((r) => r.teacher_id === Number(teacherId)),
    [requirements, teacherId],
  )
  const unassignedClasses = useMemo(
    () => classes.filter((c) => !c.class_teacher_id),
    [classes],
  )
  // Only offer subjects this teacher is actually qualified for - same
  // guardrail as the Requirements tab's teacher picker.
  const qualifiedSubjects = useMemo(
    () => subjects.filter((s) => teacher?.subject_ids.includes(s.id)),
    [subjects, teacher],
  )
  // Only classes that already have a curriculum requirement for the chosen
  // subject (so there's a periods_per_week to attach the pin to).
  const classOptionsForSubject = useMemo(() => {
    if (!newSubjectId) return []
    return requirements
      .filter((r) => r.subject_id === Number(newSubjectId))
      .map((r) => ({ req: r, cls: classes.find((c) => c.id === r.class_id) }))
      .filter((x) => x.cls)
  }, [newSubjectId, requirements, classes])

  const assignClassTeacher = async () => {
    if (!newClassTeacherOf) return
    setBusy(true)
    setError('')
    try {
      await classesApi.update(Number(newClassTeacherOf), { class_teacher_id: Number(teacherId) })
      setNewClassTeacherOf('')
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const removeClassTeacher = async (classId) => {
    setBusy(true)
    setError('')
    try {
      await classesApi.update(classId, { class_teacher_id: null })
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const assignTeaching = async () => {
    if (!newSubjectId || !newClassId) return
    const match = classOptionsForSubject.find((x) => x.cls.id === Number(newClassId))
    if (!match) return
    if (match.req.teacher_id && match.req.teacher_id !== Number(teacherId)) {
      const ok = confirm(
        `${match.cls.display_name} - ${subjectById[newSubjectId]} is currently assigned to ` +
          `${match.req.teacher_name}. Reassign it to ${teacher?.name}?`,
      )
      if (!ok) return
    }
    setBusy(true)
    setError('')
    try {
      await requirementsApi.update(match.req.id, { teacher_id: Number(teacherId) })
      setNewSubjectId('')
      setNewClassId('')
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const unassignTeaching = async (requirementId) => {
    setBusy(true)
    setError('')
    try {
      await requirementsApi.update(requirementId, { teacher_id: null })
      onChanged()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-800">Teacher Allocation</h2>
        <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="w-56">
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </div>

      {error && <Alert kind="error" onDismiss={() => setError('')} className="mb-3">{error}</Alert>}

      {!teacher ? (
        <p className="text-sm text-slate-400">No teachers yet - add one under the Teachers tab first.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-fade-in" key={teacherId}>
          {/* ---- Class teacher (homeroom) ---- */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Class Teacher Of</h3>
            <div className="space-y-2 mb-3">
              {homeroomClasses.length === 0 && (
                <p className="text-sm text-slate-400">Not a class teacher for any class.</p>
              )}
              {homeroomClasses.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <span className="text-sm text-slate-700 font-medium">{c.display_name}</span>
                  <button
                    onClick={() => removeClassTeacher(c.id)}
                    disabled={busy}
                    className="text-xs text-red-500 hover:underline transition-colors duration-150"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            {unassignedClasses.length > 0 && (
              <div className="flex gap-2">
                <Select value={newClassTeacherOf} onChange={(e) => setNewClassTeacherOf(e.target.value)}>
                  <option value="">Assign as class teacher of…</option>
                  {unassignedClasses.map((c) => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                </Select>
                <Button onClick={assignClassTeacher} disabled={!newClassTeacherOf || busy} className="shrink-0">Assign</Button>
              </div>
            )}
          </div>

          {/* ---- Subject teaching assignments ---- */}
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-2">Teaches</h3>
            <div className="space-y-2 mb-3">
              {teachingAssignments.length === 0 && (
                <p className="text-sm text-slate-400">Not pinned to teach any specific class+subject yet.</p>
              )}
              {teachingAssignments.map((r) => (
                <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <span className="text-sm text-slate-700">
                    <span className="font-medium">{subjectById[r.subject_id]}</span>
                    {' for '}
                    <span className="font-medium">{classById[r.class_id]}</span>
                    <span className="text-slate-400"> · {r.periods_per_week} periods/wk</span>
                  </span>
                  <button
                    onClick={() => unassignTeaching(r.id)}
                    disabled={busy}
                    className="text-xs text-red-500 hover:underline transition-colors duration-150"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {qualifiedSubjects.length === 0 ? (
              <p className="text-xs text-slate-400">
                {teacher.name} isn't qualified for any subject yet - add one under Teachers → Subjects first.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Select value={newSubjectId} onChange={(e) => { setNewSubjectId(e.target.value); setNewClassId('') }} className="w-36">
                  <option value="">Subject…</option>
                  {qualifiedSubjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
                <Select value={newClassId} onChange={(e) => setNewClassId(e.target.value)} className="w-40" disabled={!newSubjectId}>
                  <option value="">Class…</option>
                  {classOptionsForSubject.map(({ cls, req }) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.display_name}{req.teacher_id && req.teacher_id !== Number(teacherId) ? ` (has ${req.teacher_name})` : ''}
                    </option>
                  ))}
                </Select>
                <Button onClick={assignTeaching} disabled={!newSubjectId || !newClassId || busy} className="shrink-0">Assign</Button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap gap-1.5">
        <span className="text-xs text-slate-400 mr-1">All teachers with assignments:</span>
        {teachers
          .filter((t) => classes.some((c) => c.class_teacher_id === t.id) || requirements.some((r) => r.teacher_id === t.id))
          .map((t) => (
            <button key={t.id} onClick={() => setTeacherId(t.id)}>
              <Badge tone={t.id === Number(teacherId) ? 'brand' : 'slate'}>{t.name}</Badge>
            </button>
          ))}
      </div>
    </div>
  )
}
