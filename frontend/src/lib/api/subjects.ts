import type { Subject } from "@/types"
import { apiClient, usingMocks } from "./client"
import { mockSubjects } from "./mocks/store"

export interface SubjectInput {
  name: string
  code: string
  is_lab: boolean
}

export const subjectsApi = {
  list: async (): Promise<Subject[]> => {
    if (usingMocks()) return mockSubjects.list()
    const { data } = await apiClient.get<Subject[]>("/subjects")
    return data
  },
  create: async (input: SubjectInput): Promise<Subject> => {
    if (usingMocks()) return mockSubjects.create(input)
    const { data } = await apiClient.post<Subject>("/subjects", input)
    return data
  },
  update: async (id: number, input: Partial<SubjectInput>): Promise<Subject> => {
    if (usingMocks()) return mockSubjects.update(id, input)
    const { data } = await apiClient.put<Subject>(`/subjects/${id}`, input)
    return data
  },
  remove: async (id: number): Promise<void> => {
    if (usingMocks()) return mockSubjects.remove(id)
    await apiClient.delete(`/subjects/${id}`)
  },
}
