import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { toFriendlyErrorMessage } from "@/lib/api/client"
import { classesApi, type ClassInput } from "@/lib/api/classes"

export const classesKey = ["classes"] as const

export function useClasses() {
  return useQuery({ queryKey: classesKey, queryFn: classesApi.list })
}

export function useCreateClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ClassInput) => classesApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: classesKey })
      toast.success("Class added")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function useUpdateClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<ClassInput> }) => classesApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: classesKey })
      toast.success("Class updated")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function useDeleteClass() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => classesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: classesKey })
      toast.success("Class removed")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}
