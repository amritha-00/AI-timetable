import { useState } from 'react'
import { teachersApi } from '../api/client'
import { LoadingState } from './ui'

/**
 * Full teacher x subject qualification matrix - answers "which teacher
 * teaches which subject" at a glance, and lets you toggle a cell directly
 * instead of opening each teacher's "Subjects" modal one at a time.
 *
 * Each teacher's `subject_ids` comes pre-loaded from `GET /api/teachers`
 * (see backend/app/schemas/teacher.py), so the whole matrix renders from
 * data already on the page - toggling a cell is the only per-action request.
 */
export default function TeacherSubjectMatrix({ teachers, subjects, loading, onChanged }) {
  const [pending, setPending] = useState(null) // `${teacherId}:${subjectId}` currently saving

  const toggle = async (teacher, subjectId) => {
    const key = `${teacher.id}:${subjectId}`
    setPending(key)
    const current = new Set(teacher.subject_ids)
    current.has(subjectId) ? current.delete(subjectId) : current.add(subjectId)
    try {
      await teachersApi.setSubjects(teacher.id, [...current])
      onChanged()
    } finally {
      setPending(null)
    }
  }

  if (loading) return <LoadingState label="Loading assignments…" />

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-800">Teacher &rarr; Subject Assignments</h2>
        <p className="text-xs text-slate-400">Click a cell to toggle. Changes save immediately.</p>
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-slate-50 border-b border-r border-slate-200 px-3 py-2 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
                Teacher
              </th>
              {subjects.map((s) => (
                <th
                  key={s.id}
                  className="bg-slate-50 border-b border-slate-200 px-2 py-2 text-xs font-medium text-slate-500 whitespace-nowrap"
                  title={s.name}
                >
                  <span className="inline-block max-w-[70px] truncate align-middle">{s.name}</span>
                  {s.is_lab && <span className="ml-1 text-[10px] text-brand-400">(lab)</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {teachers.map((t, i) => (
              <tr key={t.id} className="stagger-item hover:bg-slate-50 transition-colors duration-150" style={{ animationDelay: `${Math.min(i, 14) * 20}ms` }}>
                <td className="sticky left-0 bg-white border-r border-slate-100 px-3 py-1.5 text-slate-700 font-medium whitespace-nowrap">
                  {t.name}
                </td>
                {subjects.map((s) => {
                  const checked = t.subject_ids.includes(s.id)
                  const key = `${t.id}:${s.id}`
                  const isPending = pending === key
                  return (
                    <td key={s.id} className="text-center px-2 py-1.5">
                      <button
                        onClick={() => toggle(t, s.id)}
                        disabled={isPending}
                        aria-label={`${t.name} teaches ${s.name}`}
                        className={`h-5 w-5 rounded-md border transition-all duration-150 active:scale-90 disabled:opacity-50 ${
                          checked
                            ? 'bg-brand-600 border-brand-600 text-white hover:bg-brand-700'
                            : 'bg-white border-slate-300 hover:border-brand-400 hover:bg-brand-50'
                        }`}
                      >
                        {isPending ? '…' : checked ? '✓' : ''}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
