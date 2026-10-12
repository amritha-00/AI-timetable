import type { Day, Period } from "@/types"
import { apiClient, usingMocks } from "./client"
import { mockDays, mockPeriods } from "./mocks/store"

export interface DayInput {
  name: string
  order_index: number
}

export const daysApi = {
  list: async (): Promise<Day[]> => {
    if (usingMocks()) return mockDays.list()
    const { data } = await apiClient.get<Day[]>("/days")
    return data
  },
  create: async (input: DayInput): Promise<Day> => {
    if (usingMocks()) throw new Error("Demo mode already comes with a full week set up.")
    const { data } = await apiClient.post<Day>("/days", input)
    return data
  },
  remove: async (id: number): Promise<void> => {
    if (usingMocks()) throw new Error("Demo mode already comes with a full week set up.")
    await apiClient.delete(`/days/${id}`)
  },
}

export const periodsApi = {
  list: async (): Promise<Period[]> => {
    if (usingMocks()) return mockPeriods.list()
    const { data } = await apiClient.get<Period[]>("/periods")
    return data
  },
}
