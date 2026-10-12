import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useCreateRoom, useUpdateRoom } from "@/hooks/useRooms"
import type { Room } from "@/types"

const roomSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50),
  room_type: z.enum(["classroom", "lab", "auditorium", "sports"]),
  capacity: z.coerce.number().int().min(1, "Must be at least 1").max(500),
})

// See TeacherFormSheet.tsx for why z.coerce fields need both input and
// output generics passed to useForm.
type RoomFormInput = z.input<typeof roomSchema>
type RoomFormValues = z.output<typeof roomSchema>
const emptyValues: RoomFormInput = { name: "", room_type: "classroom", capacity: 40 }

const ROOM_TYPES: { value: RoomFormValues["room_type"]; label: string }[] = [
  { value: "classroom", label: "Classroom" },
  { value: "lab", label: "Lab" },
  { value: "auditorium", label: "Auditorium" },
  { value: "sports", label: "Sports" },
]

interface RoomFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  room?: Room | null
}

export function RoomFormSheet({ open, onOpenChange, room }: RoomFormSheetProps) {
  const createRoom = useCreateRoom()
  const updateRoom = useUpdateRoom()
  const isEditing = !!room
  const isPending = createRoom.isPending || updateRoom.isPending

  const form = useForm<RoomFormInput, unknown, RoomFormValues>({ resolver: zodResolver(roomSchema), defaultValues: emptyValues })

  useEffect(() => {
    if (open) {
      form.reset(room ? { name: room.name, room_type: room.room_type, capacity: room.capacity } : emptyValues)
    }
  }, [open, room, form])

  const onSubmit = async (values: RoomFormValues) => {
    if (isEditing) await updateRoom.mutateAsync({ id: room.id, input: values })
    else await createRoom.mutateAsync(values)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit room" : "Add room"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Update this room's details." : "Add a new room or lab to your school."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 pb-4 space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Room-101 or Science Lab 1" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="room_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ROOM_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacity</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={500} {...field} value={field.value as number} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditing ? "Save changes" : "Add room"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
