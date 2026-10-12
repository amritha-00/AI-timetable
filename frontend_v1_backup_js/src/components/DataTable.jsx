import { useState } from 'react'
import { Button, Checkbox, Input, Modal, Select, SkeletonLine } from './ui'

/**
 * Generic CRUD table: renders `rows` per `columns`, with an "Add" button and
 * per-row Edit/Delete actions that open a form modal. Used by every tab on
 * the Data Management page so each entity (teachers, subjects, classes,
 * rooms, requirements) only has to describe its own field shape.
 */
export default function DataTable({ title, columns, rows, loading, onCreate, onUpdate, onDelete, extraAction, addLabel }) {
  const [modalRow, setModalRow] = useState(null) // null = closed, {} = new, {...} = editing
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const openNew = () => {
    const blank = {}
    columns.forEach((c) => {
      blank[c.key] = c.type === 'checkbox' ? false : c.default ?? ''
    })
    setModalRow(blank)
    setError('')
  }

  const openEdit = (row) => {
    setModalRow({ ...row })
    setError('')
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const isNew = modalRow.id === undefined
      const payload = {}
      columns.forEach((c) => {
        const raw = modalRow[c.key]
        if (c.nullable && (raw === '' || raw === undefined || raw === null)) {
          payload[c.key] = null
        } else {
          payload[c.key] = c.type === 'number' ? Number(raw) : raw
        }
      })
      if (isNew) await onCreate(payload)
      else await onUpdate(modalRow.id, payload)
      setModalRow(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (row) => {
    if (!confirm(`Delete this ${title.toLowerCase().replace(/s$/, '')}? This cannot be undone.`)) return
    try {
      await onDelete(row.id)
    } catch (err) {
      alert(err.message)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-slate-800">{title}</h2>
        <Button onClick={openNew}>+ {addLabel || `Add ${title.replace(/s$/, '')}`}</Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className="text-left px-4 py-2 font-medium">{c.label}</th>
              ))}
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading &&
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      <SkeletonLine className="h-3.5 w-[80%]" />
                    </td>
                  ))}
                  <td className="px-4 py-3" />
                </tr>
              ))}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length + 1} className="px-4 py-6 text-center text-slate-400 animate-fade-in">
                  No {title.toLowerCase()} yet.
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row, i) => (
                <tr
                  key={row.id}
                  className="stagger-item hover:bg-slate-50 transition-colors duration-150"
                  style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                >
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-2 text-slate-700">
                      {c.render ? c.render(row) : c.type === 'checkbox' ? (row[c.key] ? 'Yes' : 'No') : row[c.key]}
                    </td>
                  ))}
                  <td className="px-4 py-2 text-right whitespace-nowrap">
                    {extraAction && extraAction(row)}
                    <button
                      onClick={() => openEdit(row)}
                      className="text-brand-600 hover:underline text-xs font-medium mr-3 transition-colors duration-150"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(row)}
                      className="text-red-500 hover:underline text-xs font-medium transition-colors duration-150"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <Modal open={!!modalRow} onClose={() => setModalRow(null)} title={modalRow?.id === undefined ? `New ${title.replace(/s$/, '')}` : `Edit ${title.replace(/s$/, '')}`}>
        {modalRow && (
          <div className="space-y-3">
            {error && <div className="text-sm text-red-600">{error}</div>}
            {columns.map((c) => (
              <div key={c.key}>
                <label className="block text-xs font-medium text-slate-500 mb-1">{c.label}</label>
                {c.type === 'select' ? (
                  <Select
                    value={modalRow[c.key] ?? ''}
                    onChange={(e) => setModalRow({ ...modalRow, [c.key]: e.target.value })}
                  >
                    <option value="" disabled={!c.nullable}>
                      {c.nullable ? c.noneLabel || '— None —' : `Select ${c.label.toLowerCase()}`}
                    </option>
                    {/* `options` can be a static array, or a function of the row being
                        edited - used e.g. to only offer teachers qualified for whichever
                        subject is currently selected on this same row. */}
                    {(typeof c.options === 'function' ? c.options(modalRow) : c.options).map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </Select>
                ) : c.type === 'checkbox' ? (
                  <Checkbox
                    checked={!!modalRow[c.key]}
                    onChange={(e) => setModalRow({ ...modalRow, [c.key]: e.target.checked })}
                    label={c.checkboxLabel || 'Yes'}
                  />
                ) : (
                  <Input
                    type={c.type === 'number' ? 'number' : 'text'}
                    value={modalRow[c.key] ?? ''}
                    onChange={(e) => setModalRow({ ...modalRow, [c.key]: e.target.value })}
                  />
                )}
              </div>
            ))}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setModalRow(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
