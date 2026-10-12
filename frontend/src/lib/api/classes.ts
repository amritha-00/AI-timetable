import type { SchoolClass } from "@/types"
import { apiClient, usingMocks } from "./client"
import { mockClasses } from "./mocks/store"

export interface ClassInput {
  grade: number
  section: string
  strength: number
  class_teacher_id: number | null
}

export const classesApi = {
  list: async (): Promise<SchoolClass[]> => {
    if (usingMocks()) return mockClasses.list()
    const { data } = await apiClient.get<SchoolClass[]>("/classes")
    return data
  },
  create: async (input: ClassInput): Promise<SchoolClass> => {
    if (usingMocks()) return mockClasses.create(input)
    const { data } = await apiClient.post<SchoolClass>("/classes", input)
    return data
  },
  update: async (id: number, input: Partial<ClassInput>): Promise<SchoolClass> => {
    if (usingMocks()) return mockClasses.update(id, input)
    const { data } = await apiClient.put<SchoolClass>(`/classes/${id}`, input)
    return data
  },
  remove: async (id: number): Promise<void> => {
    if (usingMocks()) return mockClasses.remove(id)
    await apiClient.delete(`/classes/${id}`)
  },
}
