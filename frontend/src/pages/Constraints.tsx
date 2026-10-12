import { useEffect, useRef, useState } from "react"
import { Loader2, Send, Sparkles } from "lucide-react"
import { ConstraintsPanel } from "@/components/features/constraints/ConstraintsPanel"
import { ParsedConstraintCard } from "@/components/features/constraints/ParsedConstraintCard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useSaveConstraint } from "@/hooks/useConstraints"
import { toFriendlyErrorMessage } from "@/lib/api/client"
import { constraintsApi } from "@/lib/api/constraints"
import type { ConfirmConstraintInput, ConversationTurn, ParseResponse } from "@/types"

const EXAMPLES = [
  "Kavita Rao cannot teach on Friday afternoons",
  "Deepa Menon prefers mornings",
  "Kavita Rao should teach at most 4 periods a day",
  "Maths should be in the morning",
  "Science labs must be in a lab room",
  "Ramesh Gupta should not teach more than 2 periods in a row",
]

type Msg =
  | { id: number; kind: "user"; text: string }
  | { id: number; kind: "text"; text: string; options?: string[] }
  | { id: number; kind: "card"; parsed: ParseResponse; done?: "saved" | "discarded" }
  | { id: number; kind: "thinking" }

export default function ConstraintsPage() {
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const nextId = useRef(1)
  const bottom = useRef<HTMLDivElement>(null)
  const save = useSaveConstraint()

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" })
  }, [msgs])

  // Only the conversation since the last rule card: an old, finished rule must not bleed into a new one.
  const openTurns = () => {
    const lastCard = msgs.map((m) => m.kind).lastIndexOf("card")
    return msgs.slice(lastCard + 1)
  }
  const history = (): ConversationTurn[] =>
    openTurns().flatMap((m): ConversationTurn[] =>
      m.kind === "user" ? [{ role: "user", text: m.text }] : m.kind === "text" ? [{ role: "assistant", text: m.text }] : [],
    )

  const send = async (text: string) => {
    const t = text.trim()
    if (!t || busy) return
    const past = history()
    const sentence = [...openTurns().flatMap((m) => (m.kind === "user" ? [m.text] : [])), t].join(" - ")
    const thinkingId = nextId.current + 1
    nextId.current += 2
    setMsgs((m) => [...m, { id: thinkingId - 1, kind: "user", text: t }, { id: thinkingId, kind: "thinking" }])
    setInput("")
    setBusy(true)
    let reply: Msg
    try {
      const r = await constraintsApi.parse(t, past)
      const id = nextId.current++
      if (r.status === "resolved" && r.constraint_type) reply = { id, kind: "card", parsed: { ...r, raw_text: sentence } }
      else if (r.status === "clarification_needed")
        reply = { id, kind: "text", text: r.clarification_question ?? "Could you say a bit more?", options: r.candidates }
      else reply = { id, kind: "text", text: r.error_message ?? "I couldn't understand that. Could you rephrase it?" }
    } catch (e) {
      reply = { id: nextId.current++, kind: "text", text: toFriendlyErrorMessage(e) }
    }
    setMsgs((m) => [...m.filter((x) => x.id !== thinkingId), reply])
    setBusy(false)
  }

  const finish = (id: number, done: "saved" | "discarded") =>
    setMsgs((m) => m.map((x) => (x.id === id && x.kind === "card" ? { ...x, done } : x)))

  const confirm = (id: number, input: ConfirmConstraintInput) =>
    save.mutate(input, { onSuccess: () => finish(id, "saved") })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Constraints</h1>
        <p className="text-sm text-muted-foreground mt-1">Describe scheduling rules in plain English.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="flex h-[70vh] flex-col rounded-xl border border-border bg-card">
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.length === 0 && (
              <div className="space-y-3 pt-6 text-center">
                <Sparkles className="mx-auto h-6 w-6 text-primary" />
                <p className="text-sm text-muted-foreground">Tell me a rule, or try one of these:</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {EXAMPLES.map((ex) => (
                    <button key={ex} onClick={() => send(ex)} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-muted">
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {msgs.map((m) => {
              if (m.kind === "user")
                return <div key={m.id} className="ml-auto w-fit max-w-[80%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">{m.text}</div>
              if (m.kind === "thinking")
                return <div key={m.id} className="flex w-fit items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Thinking...</div>
              if (m.kind === "text")
                return (
                  <div key={m.id} className="space-y-2">
                    <div className="w-fit max-w-[80%] rounded-2xl bg-muted px-3 py-2 text-sm">{m.text}</div>
                    {m.options && m.options.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {m.options.map((o) => <Button key={o} size="sm" variant="outline" disabled={busy} onClick={() => send(o)}>{o}</Button>)}
                      </div>
                    )}
                  </div>
                )
              return m.done ? (
                <div key={m.id} className="w-fit rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {m.done === "saved" ? `Saved: ${m.parsed.human_description}` : "Discarded."}
                </div>
              ) : (
                <ParsedConstraintCard key={m.id} parsed={m.parsed} disabled={save.isPending} onConfirm={(i) => confirm(m.id, i)} onDiscard={() => finish(m.id, "discarded")} />
              )
            })}
            <div ref={bottom} />
          </div>
          <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); send(input) }}>
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. Mrs. Rao can't teach on Friday afternoons" aria-label="Describe a rule" />
            <Button type="submit" disabled={busy || !input.trim()} aria-label="Send"><Send className="h-4 w-4" /></Button>
          </form>
        </div>

        <aside className="space-y-3">
          <h2 className="text-sm font-semibold">Your rules</h2>
          <ConstraintsPanel />
        </aside>
      </div>
    </div>
  )
}
