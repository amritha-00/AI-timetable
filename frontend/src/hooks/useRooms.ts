import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { toFriendlyErrorMessage } from "@/lib/api/client"
import { roomsApi, type RoomInput } from "@/lib/api/rooms"

export const roomsKey = ["rooms"] as const

export function useRooms() {
  return useQuery({ queryKey: roomsKey, queryFn: roomsApi.list })
}

export function useCreateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: RoomInput) => roomsApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomsKey })
      toast.success("Room added")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function useUpdateRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: Partial<RoomInput> }) => roomsApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomsKey })
      toast.success("Room updated")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}

export function useDeleteRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => roomsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomsKey })
      toast.success("Room removed")
    },
    onError: (err) => toast.error(toFriendlyErrorMessage(err)),
  })
}
