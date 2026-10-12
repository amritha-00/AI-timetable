import type { Teacher } from "@/types"
import { apiClient, usingMocks } from "./client"
import { mockTeachers } from "./mocks/store"

export interface TeacherInput {
  name: string
  email: string | null
  phone: string | null
  max_periods_per_day: number
  is_active: boolean
}

export const teachersApi = {
  list: async (activeOnly = false): Promise<Teacher[]> => {
    if (usingMocks()) {
      const all = await mockTeachers.list()
      return activeOnly ? all.filter((t) => t.is_active) : all
    }
    const { data } = await apiClient.get<Teacher[]>("/teachers", { params: { active_only: activeOnly } })
    return data
  },

  create: async (input: TeacherInput): Promise<Teacher> => {
    if (usingMocks()) return mockTeachers.create(input)
    const { data } = await apiClient.post<Teacher>("/teachers", input)
    return data
  },

  update: async (id: number, input: Partial<TeacherInput>): Promise<Teacher> => {
    if (usingMocks()) return mockTeachers.update(id, input)
    const { data } = await apiClient.put<Teacher>(`/teachers/${id}`, input)
    return data
  },

  remove: async (id: number): Promise<void> => {
    if (usingMocks()) return mockTeachers.remove(id)
    await apiClient.delete(`/teachers/${id}`)
  },

  setSubjects: async (id: number, subjectIds: number[]): Promise<Teacher> => {
    if (usingMocks()) return mockTeachers.setSubjects(id, subjectIds)
    await apiClient.put(`/teachers/${id}/subjects`, { subject_ids: subjectIds })
    const { data } = await apiClient.get<Teacher>(`/teachers/${id}`)
    return data
  },
}
