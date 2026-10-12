import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { toFriendlyErrorMessage } from "@/lib/api/client"
import { teachersApi, type TeacherInput } from "@/lib/api/teachers"

export const teachersKey = ["teachers"] as const

export function useTeachers(activeOnly = false) {
  return useQuery({
    queryKey: [...teachersKey, { activeOnly }],
    queryFn: () => teachersApi.list(activeOnly),
  })
}

export function useCreateTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: TeacherInput) => teachersApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teachersKey })
      toast.success("Teacher added")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function useUpdateTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<TeacherInput> }) => teachersApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teachersKey })
      toast.success("Teacher updated")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function useDeleteTeacher() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => teachersApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teachersKey })
      toast.success("Teacher removed")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function useSetTeacherSubjects() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, subjectIds }: { id: number; subjectIds: number[] }) => teachersApi.setSubjects(id, subjectIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teachersKey })
      toast.success("Subjects updated")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}
