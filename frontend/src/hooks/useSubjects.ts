import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { toFriendlyErrorMessage } from "@/lib/api/client"
import { subjectsApi, type SubjectInput } from "@/lib/api/subjects"

export const subjectsKey = ["subjects"] as const

export function useSubjects() {
  return useQuery({ queryKey: subjectsKey, queryFn: subjectsApi.list })
}

export function useCreateSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SubjectInput) => subjectsApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: subjectsKey })
      toast.success("Subject added")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function useUpdateSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<SubjectInput> }) => subjectsApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: subjectsKey })
      toast.success("Subject updated")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function useDeleteSubject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => subjectsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: subjectsKey })
      toast.success("Subject removed")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}
