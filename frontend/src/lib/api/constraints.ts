import type { ConfirmConstraintInput, Constraint, ConstraintSeverity, ConversationTurn, ParseResponse } from "@/types"
import { apiClient, usingMocks } from "./client"
import { mockConstraints, mockDays, mockTeachers } from "./mocks/store"

export const constraintsApi = {
  /** history is oldest-first; lets the LLM resolve short follow-up replies
   * against what was already established earlier in the conversation. */
  parse: async (text: string, history: ConversationTurn[] = []): Promise<ParseResponse> => {
    if (usingMocks()) return mockParse(text, history)
    const { data } = await apiClient.post<ParseResponse>("/constraints/parse", { text, history })
    return data
  },

  save: async (input: ConfirmConstraintInput): Promise<Constraint> => {
    if (usingMocks()) return mockConstraints.save(input)
    const { data } = await apiClient.post<Constraint>("/constraints", input)
    return data
  },

  list: async (activeOnly = false): Promise<Constraint[]> => {
    if (usingMocks()) {
      const all = await mockConstraints.list()
      return activeOnly ? all.filter((c) => c.is_active) : all
    }
    const { data } = await apiClient.get<Constraint[]>("/constraints", { params: { active_only: activeOnly } })
    return data
  },

  update: async (
    id: number,
    input: { severity?: ConstraintSeverity; weight?: number; is_active?: boolean },
  ): Promise<Constraint> => {
    if (usingMocks()) return mockConstraints.update(id, input)
    const { data } = await apiClient.put<Constraint>(`/constraints/${id}`, input)
    return data
  },

  remove: async (id: number): Promise<void> => {
    if (usingMocks()) return mockConstraints.remove(id)
    await apiClient.delete(`/constraints/${id}`)
  },
}

const empty = (text: string): ParseResponse => ({
  status: "unparseable", raw_text: text, constraint_type: null, severity: null, weight: null, payload: null,
  llm_explanation: null, human_description: null, clarification_question: null, candidates: [], error_message: null,
})

/** Tiny rule-based stand-in for the LLM so the demo works without a backend. */
async function mockParse(text: string, history: ConversationTurn[]): Promise<ParseResponse> {
  await new Promise((r) => setTimeout(r, 700))
  const [teachers, days] = await Promise.all([mockTeachers.list(), mockDays.list()])
  const full = [...history.filter((h) => h.role === "user").map((h) => h.text), text].join(" ")
  const lower = full.toLowerCase()
  const surname = teachers.filter((t) => lower.includes(t.name.toLowerCase()))
  let matches = surname
  if (matches.length === 0) {
    matches = teachers.filter((t) => t.name.toLowerCase().split(" ").some((w) => w.length > 2 && new RegExp(`\\b${w}\\b`).test(lower)))
  }
  const answered = matches.filter((t) => text.toLowerCase().includes(t.name.toLowerCase()))
  if (answered.length === 1) matches = answered
  if (matches.length === 0) {
    return { ...empty(text), error_message: "I couldn't find a teacher in that sentence. Try naming one, like \"Mrs. Rao can't teach Friday afternoons\"." }
  }
  if (matches.length > 1) {
    return { ...empty(text), status: "clarification_needed", clarification_question: "There is more than one teacher with that name. Which one do you mean?", candidates: matches.map((t) => t.name) }
  }
  const teacher = matches[0]
  const dayIds = days.filter((d) => lower.includes(d.name.toLowerCase().slice(0, 3))).map((d) => d.id)
  const periods = /morning/.test(lower) ? [1, 2, 3, 4] : /afternoon/.test(lower) ? [5, 6, 7, 8] : [...lower.matchAll(/period (\d)/g)].map((m) => Number(m[1]))
  const unavailable = /can't|cannot|not available|unavailable|never|busy/.test(lower)
  const type = unavailable ? "teacher_unavailable" : "teacher_preferred_slot"
  const dayText = dayIds.length ? days.filter((d) => dayIds.includes(d.id)).map((d) => d.name).join(", ") : "every day"
  const slotText = periods.length ? (periods[0] === 1 && periods.length === 4 ? "in the morning" : periods[0] === 5 && periods.length === 4 ? "in the afternoon" : `in period ${periods.join(", ")}`) : "all day"
  return {
    ...empty(text), status: "resolved", constraint_type: type, severity: unavailable ? "hard" : "soft", weight: unavailable ? 1 : 3,
    payload: { teacher_id: teacher.id, ...(dayIds.length ? { day_ids: dayIds } : {}), periods },
    human_description: `${teacher.name} ${unavailable ? "is unavailable" : "prefers to teach"} on ${dayText} ${slotText}.`,
  }
}
