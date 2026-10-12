import { useEffect, useState } from 'react'
import { teachersApi } from '../api/client'
import { Button, Checkbox, Modal } from './ui'

export default function TeacherSubjectsModal({ teacher, subjects, onClose }) {
  const [selected, setSelected] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!teacher) return
    setLoading(true)
    teachersApi
      .getSubjects(teacher.id)
      .then((links) => setSelected(new Set(links.map((l) => l.subject_id))))
      .finally(() => setLoading(false))
  }, [teacher])

  const toggle = (id) => {
    const next = new Set(selected)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelected(next)
  }

  const save = async () => {
    setSaving(true)
    try {
      await teachersApi.setSubjects(teacher.id, [...selected])
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={!!teacher} onClose={onClose} title={`Subjects taught by ${teacher?.name ?? ''}`}>
      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-2">
          {subjects.map((s) => (
            <div key={s.id}>
              <Checkbox checked={selected.has(s.id)} onChange={() => toggle(s.id)} label={s.name} />
            </div>
          ))}
          <div className="flex justify-end gap-2 pt-3">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
