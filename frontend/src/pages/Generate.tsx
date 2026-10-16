import { useEffect, useMemo, useRef, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import axios from "axios"
import { AlertTriangle, CheckCircle2, Loader2, Lock, Sparkles, XCircle } from "lucide-react"
import { toast } from "sonner"
import { TimetableGrid } from "@/components/features/timetables/TimetableGrid"
import { RulesScore } from "@/components/features/timetables/ConstraintCheck"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useAuth } from "@/hooks/useAuth"
import { useClasses } from "@/hooks/useClasses"
import { useConstraints } from "@/hooks/useConstraints"
import { useDays, usePeriods } from "@/hooks/usePeriods"
import { useRequirements } from "@/hooks/useRequirements"
import { useRooms } from "@/hooks/useRooms"
import { useTeachers } from "@/hooks/useTeachers"
import { useAllEntries, useDeleteTimetable, useGenerateTimetable } from "@/hooks/useTimetables"
import { billingApi } from "@/lib/api/billing"
import { toFriendlyErrorMessage, usingMocks } from "@/lib/api/client"
import type { Timetable } from "@/types"

interface Check { ok: boolean; text: string; fixHref?: string }

/** Plain-English lines from the solver's message, dropping technical noise. */
const messageLines = (m: string | null) =>
  (m ?? "").split("\n").map((l) => l.replace(/^\s*-\s*/, "").trim()).filter(Boolean)

function TimetablePreview({ timetableId }: { timetableId: number }) {
  const { data: all = [] } = useAllEntries(timetableId)
  const { data: classes = [] } = useClasses()
  const { data: days = [] } = useDays()
  const { data: periods = [] } = usePeriods()
  const [classId, setClassId] = useState<string>("")
  const current = classId || String(classes[0]?.id ?? "")
  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Preview</h2>
        <Select value={current} onValueChange={setClassId}>
          <SelectTrigger className="w-48" aria-label="Class to preview"><SelectValue /></SelectTrigger>
          <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.display_name}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <TimetableGrid readOnly mode="class" entries={all.filter((e) => String(e.class_id) === current)} allEntries={all} days={days} periods={[...periods].sort((a, b) => a.period_number - b.period_number)} />
    </section>
  )
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`

export default function GeneratePage() {
  const { tenant, refreshTenant } = useAuth()
  const navigate = useNavigate()
  const { data: classes = [] } = useClasses()
  const { data: teachers = [] } = useTeachers()
  const { data: rooms = [] } = useRooms()
  const { data: requirements = [] } = useRequirements()
  const { data: days = [] } = useDays()
  const { data: allPeriods = [] } = usePeriods()
  const { data: constraints = [] } = useConstraints(true)
  const generate = useGenerateTimetable()
  const deleteTimetable = useDeleteTimetable()

  const [name, setName] = useState(`Timetable ${new Date().toLocaleDateString()}`)
  const [timeLimit, setTimeLimit] = useState("60")
  const [includeSoft, setIncludeSoft] = useState(true)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState<Timetable | null>(null)
  const [cancelled, setCancelled] = useState(false)
  const [paywalled, setPaywalled] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const abort = useRef<AbortController | null>(null)

  const running = generate.isPending
  useEffect(() => {
    if (!running) return
    setElapsed(0)
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [running])

  const checks = useMemo<Check[]>(() => {
    const slots = days.length * allPeriods.filter((p) => !p.is_break).length
    const out: Check[] = []
    out.push({ ok: teachers.length > 0, text: teachers.length ? `${teachers.length} teachers ready` : "Add at least one teacher", fixHref: "/setup/teachers" })
    out.push({ ok: classes.length > 0, text: classes.length ? `${classes.length} classes ready` : "Add at least one class", fixHref: "/setup/classes" })
    out.push({ ok: rooms.length > 0, text: rooms.length ? `${rooms.length} rooms available` : "Add at least one room", fixHref: "/setup/rooms" })
    out.push({ ok: days.length > 0, text: days.length ? `${days.length} working days set` : "Set at least one working day", fixHref: "/setup/periods" })
    out.push({
      ok: allPeriods.some((p) => !p.is_break),
      text: allPeriods.some((p) => !p.is_break) ? `${allPeriods.filter((p) => !p.is_break).length} periods set` : "Add at least one teaching period",
      fixHref: "/setup/periods",
    })
    for (const c of classes) {
      const total = requirements.filter((r) => r.class_id === c.id).reduce((s, r) => s + r.periods_per_week, 0)
      if (total === 0) out.push({ ok: false, text: `${c.display_name} has no subjects set up`, fixHref: "/setup/classes" })
      else if (slots && total > slots) out.push({ ok: false, text: `${c.display_name} needs ${total} periods a week but only ${slots} exist`, fixHref: "/setup/classes" })
    }
    const load = new Map<number, number>()
    for (const r of requirements) if (r.teacher_id) load.set(r.teacher_id, (load.get(r.teacher_id) ?? 0) + r.periods_per_week)
    for (const [id, l] of load) {
      const t = teachers.find((x) => x.id === id)
      if (t && l > t.max_periods_per_day * days.length)
        out.push({ ok: false, text: `${t.name} is assigned ${l} periods a week, more than they can teach (${t.max_periods_per_day * days.length})`, fixHref: "/setup/classes" })
    }
    return out
  }, [classes, teachers, rooms, requirements, days, allPeriods])

  const blockers = checks.filter((c) => !c.ok)

  const start = () => {
    setResult(null)
    setCancelled(false)
    setPaywalled(false)
    abort.current = new AbortController()
    generate.mutate(
      { options: { name: name.trim() || "Generated Timetable", time_limit_seconds: Number(timeLimit), include_soft: includeSoft }, signal: abort.current.signal },
      {
        onSuccess: setResult,
        onError: (err) => {
          if (axios.isAxiosError(err) && err.response?.status === 402) {
            setPaywalled(true)
            refreshTenant()
          } else {
            setCancelled(abort.current?.signal.aborted ?? false)
          }
        },
      },
    )
  }
  const cancel = () => abort.current?.abort()

  const doUpgrade = async () => {
    setUpgrading(true)
    try {
      const result = await billingApi.checkout()
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl
        return // navigating away to Stripe
      }
      await refreshTenant()
      setPaywalled(false)
    } catch (err) {
      toast.error(toFriendlyErrorMessage(err))
    } finally {
      setUpgrading(false)
    }
  }

  const limit = Number(timeLimit)
  const trialExhausted = !usingMocks() && !!tenant && !tenant.is_subscribed && tenant.trial_generations_remaining === 0

  return (
    <div className={result?.status === "completed" ? "space-y-6 max-w-6xl" : "space-y-6 max-w-3xl"}>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Generate timetable</h1>
        <p className="text-sm text-muted-foreground mt-1">Check everything is ready, then let the solver build a clash-free timetable.</p>
      </div>

      {paywalled || (trialExhausted && !result) ? (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4 text-center max-w-md mx-auto">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <div>
            <h2 className="font-medium">You've used your 3 free timetables</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Upgrade to the unlimited plan to keep generating timetables for {tenant?.school_name}.
            </p>
          </div>
          <div className="rounded-lg border border-border p-4 text-left space-y-1.5 text-sm text-muted-foreground">
            <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Unlimited timetable generations</p>
            <p className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> All constraint types and exports</p>
          </div>
          <Button size="lg" className="w-full" onClick={doUpgrade} disabled={upgrading}>
            <Sparkles className="h-4 w-4" /> {upgrading ? "Upgrading..." : "Upgrade now"}
          </Button>
          <p className="text-xs text-muted-foreground">Demo checkout - no real payment is taken.</p>
        </div>
      ) : running ? (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4" role="status">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="font-medium">Building your timetable...</p>
          </div>
          <Progress value={Math.min(100, (elapsed / limit) * 100)} className="h-2" />
          <div className="flex flex-wrap gap-6 text-sm">
            <span>Elapsed: <b className="tabular-nums">{fmt(elapsed)}</b></span>
            <span>Up to: <b className="tabular-nums">{fmt(limit)}</b></span>
            <span className="text-muted-foreground">Best score: shown once finished</span>
          </div>
          <p className="text-xs text-muted-foreground">It may finish sooner than the limit. Larger schools take longer.</p>
          <Button variant="outline" onClick={cancel}>Cancel</Button>
        </div>
      ) : result?.status === "completed" ? (
        <div className="rounded-xl border border-success/40 bg-success/10 p-6 space-y-3">
          <div className="flex items-center gap-2 font-medium"><CheckCircle2 className="h-5 w-5 text-success" /> Timetable ready: {result.name}</div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{classes.length} classes scheduled</Badge>
            <RulesScore timetableId={result.id} />
            <Badge variant="secondary">Took {fmt(elapsed)}</Badge>
          </div>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-0.5">
            {messageLines(result.message).map((l, i) => <li key={i}>{l}</li>)}
          </ul>
          <div className="flex gap-2">
            <Button asChild><Link to="/timetables">Save to Timetables</Link></Button>
            <Button variant="outline" onClick={() => setResult(null)}>Keep and generate another</Button>
            <Button variant="ghost" onClick={() => { deleteTimetable.mutate(result.id); setResult(null) }}>Discard</Button>
          </div>
        </div>
      ) : result ? (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6 space-y-3">
          <div className="flex items-center gap-2 font-medium"><XCircle className="h-5 w-5 text-destructive" /> We couldn't build a timetable</div>
          <p className="text-sm text-muted-foreground">Here is what's in the way:</p>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {messageLines(result.message).map((l, i) => <li key={i}>{l}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline"><Link to="/constraints">Review constraints</Link></Button>
            <Button asChild variant="outline"><Link to="/setup/classes">Review classes</Link></Button>
            <Button onClick={() => setResult(null)}>Try again</Button>
          </div>
        </div>
      ) : (
        <>
          {cancelled && <p className="text-sm text-muted-foreground">Cancelled. Nothing was saved.</p>}
          <section className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h2 className="text-sm font-semibold">Before you start</h2>
            <ul className="space-y-1.5 text-sm">
              {checks.map((c, i) => (
                <li key={i} className="flex items-center gap-2">
                  {c.ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-warning" />}
                  <span>{c.text}</span>
                  {!c.ok && c.fixHref && <Link className="text-primary text-xs underline" to={c.fixHref}>Fix</Link>}
                </li>
              ))}
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> {constraints.length} active constraints will be applied <Link className="text-primary text-xs underline" to="/constraints">Review</Link></li>
            </ul>
            {!usingMocks() && tenant && !tenant.is_subscribed && (
              <p className="text-xs text-muted-foreground border-t border-border pt-3">
                {tenant.trial_generations_remaining} of 3 free generations left.{" "}
                <button className="text-primary underline" onClick={() => navigate("/settings")}>Upgrade</button> for unlimited.
              </p>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5 space-y-4">
            <h2 className="text-sm font-semibold">Options</h2>
            <div className="space-y-1.5">
              <Label htmlFor="tt-name">Timetable name</Label>
              <Input id="tt-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>How long may it search?</Label>
              <Select value={timeLimit} onValueChange={setTimeLimit}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 seconds</SelectItem>
                  <SelectItem value="60">1 minute</SelectItem>
                  <SelectItem value="120">2 minutes</SelectItem>
                  <SelectItem value="300">5 minutes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Longer usually gives a better timetable.</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Include "nice to have" rules</p>
                <p className="text-xs text-muted-foreground">Turn off to follow only the must-follow rules.</p>
              </div>
              <Switch checked={includeSoft} onCheckedChange={setIncludeSoft} aria-label="Include soft rules" />
            </div>
          </section>

          <div className="flex items-center gap-3">
            <Button size="lg" onClick={start} disabled={blockers.length > 0}><Sparkles className="h-4 w-4" /> Generate timetable</Button>
            {blockers.length > 0 && <p className="text-sm text-muted-foreground">Fix the {blockers.length} item(s) above first.</p>}
          </div>
        </>
      )}
      {!running && result?.status === "completed" && <TimetablePreview timetableId={result.id} />}
    </div>
  )
}
