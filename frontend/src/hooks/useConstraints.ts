import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { toFriendlyErrorMessage } from "@/lib/api/client"
import { constraintsApi } from "@/lib/api/constraints"
import type { ConfirmConstraintInput, ConstraintSeverity } from "@/types"

export const constraintsKey = ["constraints"] as const

export function useConstraints(activeOnly = false) {
  return useQuery({
    queryKey: [...constraintsKey, { activeOnly }],
    queryFn: () => constraintsApi.list(activeOnly),
  })
}

export function useSaveConstraint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: ConfirmConstraintInput) => constraintsApi.save(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: constraintsKey })
      toast.success("Constraint saved")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function useUpdateConstraint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number
      input: { severity?: ConstraintSeverity; weight?: number; is_active?: boolean }
    }) => constraintsApi.update(id, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: constraintsKey }),
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function useDeleteConstraint() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => constraintsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: constraintsKey })
      toast.success("Constraint deleted")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}
