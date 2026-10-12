import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { timetablesApi } from '../api/client'
import { Alert, Badge, Button, Card, Input, LoadingState, Spinner } from '../components/ui'

const STATUS_TONE = { completed: 'green', failed: 'red', draft: 'slate', generating: 'amber' }

export default function GeneratePage() {
  const [name, setName] = useState('Weekly Timetable')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [explanations, setExplanations] = useState({})
  const navigate = useNavigate()

  const loadHistory = () =>
    timetablesApi.list().then(setHistory).catch((err) => setError(err.message)).finally(() => setHistoryLoading(false))
  useEffect(() => { loadHistory() }, [])

  const generate = async () => {
    setGenerating(true)
    setError('')
    setResult(null)
    try {
      const r = await timetablesApi.generate(name)
      setResult(r)
      loadHistory()
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  const explain = async (id) => {
    setExplanations((prev) => ({ ...prev, [id]: 'loading' }))
    try {
      const r = await timetablesApi.explain(id)
      setExplanations((prev) => ({ ...prev, [id]: r.explanation }))
    } catch (err) {
      setExplanations((prev) => ({ ...prev, [id]: err.message }))
    }
  }

  const removeTimetable = async (id) => {
    if (!confirm('Delete this timetable and all its entries?')) return
    await timetablesApi.remove(id)
    loadHistory()
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-800 mb-1">Generate Timetable</h1>
      <p className="text-sm text-slate-500 mb-4">
        Runs the OR-Tools CP-SAT solver against your current roster and active constraints. This can take up to
        the configured solver time limit (30s by default).
      </p>

      <Card className="p-5 mb-6">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">Timetable name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={generating} />
          </div>
          <Button onClick={generate} disabled={generating} className="min-w-[168px]">
            {generating ? (
              <>
                <Spinner className="h-4 w-4" /> Generating…
              </>
            ) : (
              'Generate Timetable'
            )}
          </Button>
        </div>
        {generating && (
          <div className="mt-3 animate-fade-in">
            <div className="progress-track"><span /></div>
            <p className="text-xs text-slate-400 mt-2">
              Solving… this runs Google OR-Tools CP-SAT against every hard and soft constraint. Please wait.
            </p>
          </div>
        )}
      </Card>

      {error && <Alert kind="error" onDismiss={() => setError('')}>{error}</Alert>}

      {result && (
        <Card className="p-5 mb-6 animate-scale-in">
          <div className="flex items-center gap-2 mb-2">
            <Badge tone={STATUS_TONE[result.status]}>{result.status}</Badge>
            <span className="font-medium text-slate-800">{result.name}</span>
            {result.score !== null && <span className="text-xs text-slate-500">score: {result.score}</span>}
          </div>
          <pre className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-md p-3 mb-3">{result.message}</pre>
          {result.status === 'completed' ? (
            <Button onClick={() => navigate(`/viewer?timetable=${result.id}`)}>View Timetable →</Button>
          ) : (
            <Button variant="secondary" onClick={() => explain(result.id)}>Explain in plain English</Button>
          )}
          {explanations[result.id] && (
            <Alert kind="info" className="mt-3">
              {explanations[result.id] === 'loading' ? 'Thinking…' : explanations[result.id]}
            </Alert>
          )}
        </Card>
      )}

      <h2 className="font-semibold text-slate-800 mb-3">History</h2>
      {historyLoading ? (
        <LoadingState label="Loading history…" />
      ) : (
        <div className="space-y-2">
          {history.length === 0 && <p className="text-sm text-slate-400 animate-fade-in">No timetables generated yet.</p>}
          {history.map((h, i) => (
            <Card
              key={h.id}
              className="stagger-item p-4 hover:shadow-md"
              style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge tone={STATUS_TONE[h.status]}>{h.status}</Badge>
                    <span className="font-medium text-slate-800 text-sm">{h.name}</span>
                    {h.score !== null && <span className="text-xs text-slate-500">score: {h.score}</span>}
                  </div>
                  <p className="text-xs text-slate-400">{new Date(h.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  {h.status === 'completed' && (
                    <Button variant="secondary" onClick={() => navigate(`/viewer?timetable=${h.id}`)}>View</Button>
                  )}
                  <Button variant="ghost" onClick={() => explain(h.id)}>Explain</Button>
                  <Button variant="danger" onClick={() => removeTimetable(h.id)}>Delete</Button>
                </div>
              </div>
              {explanations[h.id] && (
                <Alert kind="info" className="mt-3">
                  {explanations[h.id] === 'loading' ? 'Thinking…' : explanations[h.id]}
                </Alert>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
