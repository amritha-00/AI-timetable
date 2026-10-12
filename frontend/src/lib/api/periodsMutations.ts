import type { Period } from "@/types"
import { apiClient, usingMocks } from "./client"

export interface PeriodInput {
  period_number: number
  start_time: string
  end_time: string
  is_break: boolean
  label: string | null
}

/**
 * Periods are read via `periodsApi.list()` in periods.ts; write operations
 * live here to keep that file's read-only mock wiring simple. The mock
 * layer doesn't simulate period mutations (a 9-row schedule that rarely
 * changes) - creating/editing a period always requires the real backend.
 */
export const periodsMutationsApi = {
  create: async (input: PeriodInput): Promise<Period> => {
    if (usingMocks()) throw new Error("Editing the period schedule needs the real backend - turn off demo mode.")
    const { data } = await apiClient.post<Period>("/periods", input)
    return data
  },
  update: async (id: number, input: Partial<PeriodInput>): Promise<Period> => {
    if (usingMocks()) throw new Error("Editing the period schedule needs the real backend - turn off demo mode.")
    const { data } = await apiClient.put<Period>(`/periods/${id}`, input)
    return data
  },
  remove: async (id: number): Promise<void> => {
    if (usingMocks()) throw new Error("Editing the period schedule needs the real backend - turn off demo mode.")
    await apiClient.delete(`/periods/${id}`)
  },
}
