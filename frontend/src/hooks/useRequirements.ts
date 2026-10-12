import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { toFriendlyErrorMessage } from "@/lib/api/client"
import { requirementsApi, type RequirementInput } from "@/lib/api/requirements"

export const requirementsKey = ["requirements"] as const

export function useRequirements(classId?: number) {
  return useQuery({
    queryKey: [...requirementsKey, { classId }],
    queryFn: () => requirementsApi.list(classId),
  })
}

export function useCreateRequirement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RequirementInput) => requirementsApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: requirementsKey })
      toast.success("Requirement added")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function useUpdateRequirement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<RequirementInput> }) => requirementsApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: requirementsKey })
      toast.success("Requirement updated")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function useDeleteRequirement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => requirementsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: requirementsKey })
      toast.success("Requirement removed")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}
