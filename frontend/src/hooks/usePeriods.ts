import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { toFriendlyErrorMessage } from "@/lib/api/client"
import { daysApi, periodsApi } from "@/lib/api/periods"
import { periodsMutationsApi, type PeriodInput } from "@/lib/api/periodsMutations"

export const periodsKey = ["periods"] as const

export const daysKey = ["days"] as const

export function useDays() {
  return useQuery({ queryKey: daysKey, queryFn: daysApi.list })
}

export function useCreateDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: daysApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: daysKey }),
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function useDeleteDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => daysApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: daysKey }),
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function usePeriods() {
  return useQuery({ queryKey: periodsKey, queryFn: periodsApi.list })
}

export function useCreatePeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: PeriodInput) => periodsMutationsApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: periodsKey })
      toast.success("Period added")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function useUpdatePeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<PeriodInput> }) => periodsMutationsApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: periodsKey })
      toast.success("Period updated")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function useDeletePeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => periodsMutationsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: periodsKey })
      toast.success("Period removed")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}
