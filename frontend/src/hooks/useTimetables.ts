import axios from "axios"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { toFriendlyErrorMessage } from "@/lib/api/client"
import type { GenerateOptions } from "@/types"
import { timetablesApi } from "@/lib/api/timetables"

export const timetablesKey = ["timetables"] as const

export function useTimetables() {
  return useQuery({ queryKey: timetablesKey, queryFn: timetablesApi.list })
}

export function useTimetable(id: number | undefined) {
  return useQuery({
    queryKey: [...timetablesKey, id],
    queryFn: () => timetablesApi.get(id as number),
    enabled: id !== undefined,
  })
}

export function useTimetableEntries(id: number | undefined, filters: { class_id?: number; teacher_id?: number }) {
  return useQuery({
    queryKey: [...timetablesKey, id, "entries", filters],
    queryFn: () => timetablesApi.entries(id as number, filters),
    enabled: id !== undefined && (filters.class_id !== undefined || filters.teacher_id !== undefined),
  })
}

export function useGenerateTimetable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ options, signal }: { options: GenerateOptions; signal?: AbortSignal }) =>
      timetablesApi.generate(options, signal),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: timetablesKey })
      if (result.status === "completed") toast.success("Timetable generated")
      else toast.error("Couldn't generate a timetable - see details below")
    },
    onError: (err) => {
      if (!axios.isCancel(err)) toast.error(toFriendlyErrorMessage(err))
    },
  })
}

export function useDeleteTimetable() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => timetablesApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: timetablesKey })
      toast.success("Timetable deleted")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function useMoveTimetableEntry(timetableId: number) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ entryId, dayId, periodId }: { entryId: number; dayId: number; periodId: number }) =>
      timetablesApi.moveEntry(timetableId, entryId, dayId, periodId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...timetablesKey, timetableId, "entries"] })
    },
    onError: (err) => {
      toast.error(toFriendlyErrorMessage(err))
    },
  })
}

/** Every entry of a timetable in one request; the viewer filters by
 * class/teacher/room client-side so tab switches are instant and drag
 * validation can see the whole school. */
export function useAllEntries(id: number | undefined) {
  return useQuery({
    queryKey: [...timetablesKey, id, "entries", "all"],
    queryFn: () => timetablesApi.entries(id as number, {}),
    enabled: id !== undefined,
  })
}
