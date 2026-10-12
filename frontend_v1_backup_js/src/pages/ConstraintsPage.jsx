import { useEffect, useRef, useState } from 'react'
import { constraintsApi } from '../api/client'
import { Alert, Badge, Button, Input, LoadingState, Select, Spinner } from '../components/ui'

const EXAMPLES = [
  "Mrs. Rao can't teach Friday afternoons",
  'Mathematics should be in the first two periods for Grade 10 - A',
  "Anita Sharma shouldn't teach more than 3 periods back to back",
  'Computer Science should always be in Computer Lab 1',
]

let nextId = 1
const newId = () => nextId++

/** Turns a message list into the {role, text} history the backend needs to
 * resolve follow-ups - a short reply like "Kiran Rao" only makes sense next
 * to what was already said. Text summaries stand in for the richer bubbles
 * (a saved confirm card, an error) so the LLM still sees what happened. */
function toApiHistory(messages) {
  return messages
    .filter((m) => m.kind !== 'error')
    .map((m) => ({
      role: m.role,
      text:
        m.kind === 'resolved' ? m.result.llm_explanation || m.result.human_description
        : m.kind === 'clarification' ? m.result.clarification_question
        : m.kind === 'saved' ? `Saved: ${m.result.human_description}`
        : m.text,
    }))
    .filter((t) => t.text)
}

function ResolvedCard({ result, onSaved }) {
  const [severity, setSeverity] = useState(result.severity || 'hard')
  const [weight, setWeight] = useState(result.weight ?? 3)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) {
    return <p className="text-xs text-slate-400 italic">Dismissed.</p>
  }

  const confirm = async () => {
    setSaving(true)
    setError('')
    try {
      await constraintsApi.save({
        constraint_type: result.constraint_type,
        raw_text: result.raw_text,
        payload: result.payload,
        severity,
        weight: Number(weight),
      })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Badge tone="brand">{result.constraint_type.replaceAll('_', ' ')}</Badge>
      </div>
      <p className="text-sm text-slate-800 mb-3">{result.human_description}</p>

      <div className="flex flex-wrap items-end gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Severity</label>
          <Select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-32">
            <option value="hard">Hard (must)</option>
            <option value="soft">Soft (prefer)</option>
          </Select>
        </div>
        {severity === 'soft' && (
          <div className="animate-fade-in">
            <label className="block text-xs font-medium text-slate-500 mb-1">Weight</label>
            <Input type="number" step="0.5" min="0.1" max="20" value={weight} onChange={(e) => setWeight(e.target.value)} className="w-24" />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <div className="flex gap-2">
        <Button onClick={confirm} disabled={saving}>
          {saving ? (<><Spinner className="h-4 w-4" /> Saving…</>) : 'Confirm & Save'}
        </Button>
        <Button variant="secondary" onClick={() => setDismissed(true)}>Reject</Button>
      </div>
    </div>
  )
}

function Bubble({ message, onSaved }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
          isUser
            ? 'bg-brand-600 text-white rounded-br-sm'
            : message.kind === 'error'
              ? 'bg-red-50 text-red-800 border border-red-200 rounded-bl-sm'
              : message.kind === 'clarification'
                ? 'bg-amber-50 text-amber-900 border border-amber-200 rounded-bl-sm'
                : message.kind === 'saved'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-bl-sm'
                  : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm'
        }`}
      >
        {message.kind === 'resolved' ? (
          <ResolvedCard result={message.result} onSaved={() => onSaved(message)} />
        ) : message.kind === 'clarification' ? (
          <div>
            <p>{message.result.clarification_question}</p>
            {message.result.candidates?.length > 0 && (
              <ul className="list-disc list-inside mt-1.5 text-xs opacity-90">
                {message.result.candidates.map((c) => <li key={c}>{c}</li>)}
              </ul>
            )}
          </div>
        ) : message.kind === 'saved' ? (
          <p>✓ Saved: {message.result.human_description}</p>
        ) : (
          <p className="whitespace-pre-wrap">{message.text}</p>
        )}
      </div>
    </div>
  )
}

export default function ConstraintsPage() {
  const [text, setText] = useState('')
  const [messages, setMessages] = useState([])
  const [parsing, setParsing] = useState(false)
  const [saved, setSaved] = useState([])
  const [savedLoading, setSavedLoading] = useState(true)
  const [error, setError] = useState('')
  const bottomRef = useRef(null)

  const loadSaved = () =>
    constraintsApi.list().then(setSaved).catch((err) => setError(err.message)).finally(() => setSavedLoading(false))
  useEffect(() => { loadSaved() }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, parsing])

  const submit = async (e) => {
    e?.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || parsing) return

    const userMessage = { id: newId(), role: 'user', text: trimmed }
    const historyForApi = toApiHistory(messages)
    setMessages((prev) => [...prev, userMessage])
    setText('')
    setParsing(true)
    setError('')

    try {
      const r = await constraintsApi.parse(trimmed, historyForApi)
      let assistantMessage
      if (r.status === 'resolved') {
        assistantMessage = { id: newId(), role: 'assistant', kind: 'resolved', result: r }
      } else if (r.status === 'clarification_needed') {
        assistantMessage = { id: newId(), role: 'assistant', kind: 'clarification', result: r }
      } else {
        assistantMessage = {
          id: newId(), role: 'assistant', kind: 'error',
          text: r.error_message || 'Could not parse this sentence.',
        }
      }
      setMessages((prev) => [...prev, assistantMessage])
    } catch (err) {
      setMessages((prev) => [...prev, { id: newId(), role: 'assistant', kind: 'error', text: err.message }])
    } finally {
      setParsing(false)
    }
  }

  const handleSaved = (assistantMessage) => {
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: 'assistant', kind: 'saved', result: assistantMessage.result },
    ])
    loadSaved()
  }

  const toggleActive = async (c) => {
    await constraintsApi.update(c.id, { is_active: !c.is_active })
    loadSaved()
  }

  const remove = async (c) => {
    if (!confirm('Delete this constraint?')) return
    await constraintsApi.remove(c.id)
    loadSaved()
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-160px)]">
      <div className="lg:col-span-3 flex flex-col min-h-0">
        <h1 className="text-xl font-semibold text-slate-800 mb-1">Constraints</h1>
        <p className="text-sm text-slate-500 mb-3">
          Chat in plain English - the LLM understands follow-ups too, so if it asks a question you can just
          reply directly instead of restating the whole sentence.
        </p>

        <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3 grid-scroll">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-3 text-slate-400 animate-fade-in">
              <p className="text-sm">Try one of these, or type your own:</p>
              <div className="flex flex-wrap gap-1.5 justify-center max-w-md">
                {EXAMPLES.map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setText(ex)}
                    className="text-xs px-2.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-600 transition-all duration-150 hover:bg-slate-100 hover:-translate-y-px"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m) => <Bubble key={m.id} message={m} onSaved={handleSaved} />)}
          {parsing && (
            <div className="flex justify-start animate-fade-in">
              <div className="rounded-2xl rounded-bl-sm bg-white border border-slate-200 px-4 py-2.5 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-bounce" />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <form onSubmit={submit} className="flex gap-2 mt-3">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={messages.length === 0 ? "e.g. Mrs. Rao can't teach Friday afternoons" : 'Reply…'}
            autoFocus
          />
          <Button type="submit" disabled={parsing || !text.trim()} className="shrink-0">
            {parsing ? <Spinner className="h-4 w-4" /> : 'Send'}
          </Button>
          {messages.length > 0 && (
            <Button type="button" variant="ghost" onClick={() => setMessages([])} className="shrink-0">
              New chat
            </Button>
          )}
        </form>
      </div>

      <div className="lg:col-span-2 min-h-0 overflow-y-auto">
        {error && <Alert kind="error" onDismiss={() => setError('')} className="mb-3">{error}</Alert>}
        <h2 className="font-semibold text-slate-800 mb-3">Saved constraints ({saved.length})</h2>
        {savedLoading ? (
          <LoadingState label="Loading saved constraints…" />
        ) : (
          <div className="space-y-2">
            {saved.length === 0 && <p className="text-sm text-slate-400 animate-fade-in">No constraints saved yet.</p>}
            {saved.map((c, i) => (
              <div
                key={c.id}
                className="stagger-item rounded-lg border border-slate-200 bg-white p-3 transition-shadow duration-200 hover:shadow-md"
                style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
              >
                <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                  <Badge tone={c.severity === 'hard' ? 'red' : 'amber'}>{c.severity}</Badge>
                  <Badge>{c.constraint_type.replaceAll('_', ' ')}</Badge>
                  {!c.is_active && <Badge tone="slate">disabled</Badge>}
                </div>
                <p className="text-sm text-slate-700 mb-2">{c.description}</p>
                <div className="flex gap-3 text-xs">
                  <button onClick={() => toggleActive(c)} className="text-brand-600 hover:underline transition-colors duration-150">
                    {c.is_active ? 'Disable' : 'Enable'}
                  </button>
                  <button onClick={() => remove(c)} className="text-red-500 hover:underline transition-colors duration-150">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
