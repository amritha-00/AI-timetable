import type { GenerateOptions, Timetable, TimetableEntry } from "@/types"
import { getToken } from "./auth"
import { apiClient, usingMocks } from "./client"
import { mockTimetables } from "./mocks/store"

export const timetablesApi = {
  generate: async (options: GenerateOptions, signal?: AbortSignal): Promise<Timetable> => {
    const name = options.name
    if (usingMocks()) {
      return {
        id: 0,
        name,
        status: "failed",
        score: null,
        message:
          "Generating a real timetable needs the CP-SAT solver on the backend - turn off demo mode to try it live.",
        created_at: new Date().toISOString(),
      }
    }
    const { data } = await apiClient.post<Timetable>("/timetables/generate", options, { signal, timeout: 0 })
    return data
  },

  list: async (): Promise<Timetable[]> => {
    if (usingMocks()) return mockTimetables.list()
    const { data } = await apiClient.get<Timetable[]>("/timetables")
    return data
  },

  get: async (id: number): Promise<Timetable> => {
    if (usingMocks()) return mockTimetables.get(id)
    const { data } = await apiClient.get<Timetable>(`/timetables/${id}`)
    return data
  },

  entries: async (
    id: number,
    filters: { class_id?: number | string; teacher_id?: number | string } = {},
  ): Promise<TimetableEntry[]> => {
    if (usingMocks()) {
      return mockTimetables.entries(id, {
        class_id: filters.class_id ? Number(filters.class_id) : undefined,
        teacher_id: filters.teacher_id ? Number(filters.teacher_id) : undefined,
      })
    }
    const { data } = await apiClient.get<TimetableEntry[]>(`/timetables/${id}/entries`, { params: filters })
    return data
  },

  explain: async (id: number): Promise<{ timetable_id: number; explanation: string }> => {
    if (usingMocks()) {
      return { timetable_id: id, explanation: "Plain-English explanations need the real backend to be turned on." }
    }
    const { data } = await apiClient.get(`/timetables/${id}/explain`)
    return data
  },

  moveEntry: async (timetableId: number, entryId: number, dayId: number, periodId: number): Promise<TimetableEntry> => {
    if (usingMocks()) {
      throw new Error("Moving entries needs the real backend - turn off demo mode to try it live.")
    }
    const { data } = await apiClient.put<TimetableEntry>(`/timetables/${timetableId}/entries/${entryId}/move`, {
      day_id: dayId,
      period_id: periodId,
    })
    return data
  },

  remove: async (id: number): Promise<void> => {
    if (usingMocks()) return mockTimetables.remove(id)
    await apiClient.delete(`/timetables/${id}`)
  },

  // A plain <a href> download can't carry an Authorization header, so the
  // tenant's token rides along as a query param instead (the backend's
  // get_current_tenant accepts either - see app/auth.py).
  exportUrl: (id: number, format: "excel" | "pdf"): string => {
    const token = getToken()
    const base = `/api/timetables/${id}/export/${format}`
    return token ? `${base}?token=${encodeURIComponent(token)}` : base
  },
}
