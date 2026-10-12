import type { Room, RoomType } from "@/types"
import { apiClient, usingMocks } from "./client"
import { mockRooms } from "./mocks/store"

export interface RoomInput {
  name: string
  room_type: RoomType
  capacity: number
}

export const roomsApi = {
  list: async (): Promise<Room[]> => {
    if (usingMocks()) return mockRooms.list()
    const { data } = await apiClient.get<Room[]>("/rooms")
    return data
  },
  create: async (input: RoomInput): Promise<Room> => {
    if (usingMocks()) return mockRooms.create(input)
    const { data } = await apiClient.post<Room>("/rooms", input)
    return data
  },
  update: async (id: number, input: Partial<RoomInput>): Promise<Room> => {
    if (usingMocks()) return mockRooms.update(id, input)
    const { data } = await apiClient.put<Room>(`/rooms/${id}`, input)
    return data
  },
  remove: async (id: number): Promise<void> => {
    if (usingMocks()) return mockRooms.remove(id)
    await apiClient.delete(`/rooms/${id}`)
  },
}
