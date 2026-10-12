import type { Requirement } from "@/types"
import { apiClient, usingMocks } from "./client"
import { mockRequirements } from "./mocks/store"

export interface RequirementInput {
  class_id: number
  subject_id: number
  periods_per_week: number
  teacher_id: number | null
}

export const requirementsApi = {
  list: async (classId?: number): Promise<Requirement[]> => {
    if (usingMocks()) return mockRequirements.list(classId)
    const { data } = await apiClient.get<Requirement[]>("/requirements", {
      params: classId ? { class_id: classId } : {},
    })
    return data
  },
  create: async (input: RequirementInput): Promise<Requirement> => {
    if (usingMocks()) return mockRequirements.create(input)
    const { data } = await apiClient.post<Requirement>("/requirements", input)
    return data
  },
  update: async (id: number, input: Partial<RequirementInput>): Promise<Requirement> => {
    if (usingMocks()) return mockRequirements.update(id, input)
    const { data } = await apiClient.put<Requirement>(`/requirements/${id}`, input)
    return data
  },
  remove: async (id: number): Promise<void> => {
    if (usingMocks()) return mockRequirements.remove(id)
    await apiClient.delete(`/requirements/${id}`)
  },
}
