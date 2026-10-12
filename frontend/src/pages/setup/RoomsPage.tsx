import type { ColumnDef } from "@tanstack/react-table"
import { DoorOpen, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CsvImportSheet } from "@/components/features/shared/CsvImportSheet"
import { DataTable } from "@/components/features/shared/DataTable"
import { DeleteConfirmDialog } from "@/components/features/shared/DeleteConfirmDialog"
import { EmptyState } from "@/components/features/shared/EmptyState"
import { RoomFormSheet } from "@/components/features/rooms/RoomFormSheet"
import { useCreateRoom, useDeleteRoom, useRooms } from "@/hooks/useRooms"
import type { Room, RoomType } from "@/types"

const ROOM_TYPE_LABEL: Record<RoomType, string> = {
  classroom: "Classroom",
  lab: "Lab",
  auditorium: "Auditorium",
  sports: "Sports",
}

const VALID_ROOM_TYPES = new Set<string>(["classroom", "lab", "auditorium", "sports"])

export default function RoomsPage() {
  const { data: rooms = [], isLoading } = useRooms()
  const createRoom = useCreateRoom()
  const deleteRoom = useDeleteRoom()

  const [formOpen, setFormOpen] = useState(false)
  const [editingRoom, setEditingRoom] = useState<Room | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null)

  const columns: ColumnDef<Room, unknown>[] = useMemo(
    () => [
      { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      {
        accessorKey: "room_type",
        header: "Type",
        cell: ({ row }) => (
          <Badge className={row.original.room_type === "lab" ? "bg-primary/10 text-primary border-transparent" : ""} variant={row.original.room_type === "lab" ? undefined : "secondary"}>
            {ROOM_TYPE_LABEL[row.original.room_type]}
          </Badge>
        ),
      },
      { accessorKey: "capacity", header: "Capacity", cell: ({ row }) => <span className="font-mono text-sm">{row.original.capacity}</span> },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={`Edit ${row.original.name}`}
              onClick={() => {
                setEditingRoom(row.original)
                setFormOpen(true)
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              aria-label={`Delete ${row.original.name}`}
              onClick={() => setDeleteTarget(row.original)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rooms</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage classrooms, labs, and other spaces.</p>
        </div>
        <Button
          onClick={() => {
            setEditingRoom(null)
            setFormOpen(true)
          }}
        >
          <Plus className="h-4 w-4" /> Add room
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={rooms}
        isLoading={isLoading}
        searchPlaceholder="Search rooms..."
        onImportClick={() => setImportOpen(true)}
        emptyState={
          <EmptyState
            icon={DoorOpen}
            title="No rooms yet"
            description="Add classrooms and labs so the solver has places to schedule classes."
            action={
              <Button
                onClick={() => {
                  setEditingRoom(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="h-4 w-4" /> Add your first room
              </Button>
            }
          />
        }
      />

      <RoomFormSheet open={formOpen} onOpenChange={setFormOpen} room={editingRoom} />

      <CsvImportSheet
        open={importOpen}
        onOpenChange={setImportOpen}
        entityLabel="Room"
        templateHeaders={["name", "room_type", "capacity"]}
        templateSampleRows={[["Room-101", "classroom", "45"], ["Science Lab 1", "lab", "30"]]}
        previewColumns={[
          { key: "name", label: "Name" },
          { key: "room_type", label: "Type" },
          { key: "capacity", label: "Capacity" },
        ]}
        parseRow={(row) => {
          const errors: string[] = []
          const name = row.name?.trim()
          const roomType = row.room_type?.trim().toLowerCase()
          const capacity = Number(row.capacity || 40)
          if (!name) errors.push("Name is required")
          if (!roomType || !VALID_ROOM_TYPES.has(roomType)) {
            errors.push("Type must be classroom, lab, auditorium, or sports")
          }
          if (!Number.isFinite(capacity) || capacity < 1) errors.push("Capacity must be a positive number")
          if (errors.length > 0) return { data: null, errors }
          return { data: { name, room_type: roomType as RoomType, capacity }, errors: [] }
        }}
        onImport={async (rows) => {
          for (const row of rows) {
            await createRoom.mutateAsync(row)
          }
        }}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemLabel={deleteTarget?.name ?? ""}
        isPending={deleteRoom.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteRoom.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
        }}
      />
    </div>
  )
}
