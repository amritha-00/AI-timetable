import type { ColumnDef } from "@tanstack/react-table"
import { Pencil, Plus, Trash2, Users } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CsvImportSheet } from "@/components/features/shared/CsvImportSheet"
import { DataTable } from "@/components/features/shared/DataTable"
import { DeleteConfirmDialog } from "@/components/features/shared/DeleteConfirmDialog"
import { EmptyState } from "@/components/features/shared/EmptyState"
import { TeacherFormSheet } from "@/components/features/teachers/TeacherFormSheet"
import { useClasses } from "@/hooks/useClasses"
import { useRequirements } from "@/hooks/useRequirements"
import { useSubjects } from "@/hooks/useSubjects"
import { useCreateTeacher, useDeleteTeacher, useTeachers } from "@/hooks/useTeachers"
import type { Teacher } from "@/types"

export default function TeachersPage() {
  const { data: teachers = [], isLoading } = useTeachers()
  const { data: subjects = [] } = useSubjects()
  const { data: classes = [] } = useClasses()
  const { data: requirements = [] } = useRequirements()
  const createTeacher = useCreateTeacher()
  const deleteTeacher = useDeleteTeacher()

  const [formOpen, setFormOpen] = useState(false)
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Teacher | null>(null)

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s.name])), [subjects])

  const usageOf = (teacherId: number): string | undefined => {
    const classCount = classes.filter((c) => c.class_teacher_id === teacherId).length
    const reqCount = requirements.filter((r) => r.teacher_id === teacherId).length
    const parts: string[] = []
    if (classCount > 0) parts.push(`class teacher for ${classCount} class${classCount === 1 ? "" : "es"}`)
    if (reqCount > 0) parts.push(`pinned to teach ${reqCount} class+subject assignment${reqCount === 1 ? "" : "s"}`)
    if (parts.length === 0) return undefined
    return `Currently ${parts.join(" and ")}. Deleting will clear these assignments.`
  }

  const columns: ColumnDef<Teacher, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
      },
      {
        accessorKey: "email",
        header: "Email",
        cell: ({ row }) => row.original.email ?? <span className="text-muted-foreground">-</span>,
      },
      {
        id: "subjects",
        header: "Subjects",
        accessorFn: (row) => row.subject_ids.map((id) => subjectById.get(id)).join(", "),
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-1">
            {row.original.subject_ids.length === 0 ? (
              <span className="text-muted-foreground text-sm">None assigned</span>
            ) : (
              row.original.subject_ids.map((id) => (
                <Badge key={id} variant="secondary">
                  {subjectById.get(id) ?? "Unknown"}
                </Badge>
              ))
            )}
          </div>
        ),
      },
      {
        accessorKey: "max_periods_per_day",
        header: "Max periods/day",
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.max_periods_per_day}</span>,
      },
      {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row }) =>
          row.original.is_active ? (
            <Badge className="bg-success/15 text-success border-transparent">Active</Badge>
          ) : (
            <Badge variant="secondary">Inactive</Badge>
          ),
      },
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
                setEditingTeacher(row.original)
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
    [subjectById],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Teachers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your teaching staff and what they can teach.</p>
        </div>
        <Button
          onClick={() => {
            setEditingTeacher(null)
            setFormOpen(true)
          }}
        >
          <Plus className="h-4 w-4" /> Add teacher
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={teachers}
        isLoading={isLoading}
        searchPlaceholder="Search teachers..."
        onImportClick={() => setImportOpen(true)}
        emptyState={
          <EmptyState
            icon={Users}
            title="No teachers yet"
            description="Add your teaching staff to start building your school's roster."
            action={
              <Button
                onClick={() => {
                  setEditingTeacher(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="h-4 w-4" /> Add your first teacher
              </Button>
            }
          />
        }
      />

      <TeacherFormSheet open={formOpen} onOpenChange={setFormOpen} teacher={editingTeacher} />

      <CsvImportSheet
        open={importOpen}
        onOpenChange={setImportOpen}
        entityLabel="Teacher"
        templateHeaders={["name", "email", "phone", "max_periods_per_day"]}
        templateSampleRows={[["Anita Sharma", "anita.sharma@school.edu", "9800000001", "6"]]}
        previewColumns={[
          { key: "name", label: "Name" },
          { key: "email", label: "Email" },
          { key: "max_periods_per_day", label: "Max/day" },
        ]}
        parseRow={(row) => {
          const errors: string[] = []
          const name = row.name?.trim()
          if (!name) errors.push("Name is required")
          const maxPeriods = Number(row.max_periods_per_day || 6)
          if (!Number.isFinite(maxPeriods) || maxPeriods < 1 || maxPeriods > 10) {
            errors.push("Max periods/day must be 1-10")
          }
          if (row.email && !/^\S+@\S+\.\S+$/.test(row.email)) errors.push("Invalid email")
          if (errors.length > 0) return { data: null, errors }
          return {
            data: {
              name,
              email: row.email?.trim() || null,
              phone: row.phone?.trim() || null,
              max_periods_per_day: maxPeriods,
              is_active: true,
            },
            errors: [],
          }
        }}
        onImport={async (rows) => {
          for (const row of rows) {
            await createTeacher.mutateAsync(row)
          }
        }}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemLabel={deleteTarget?.name ?? ""}
        usageWarning={deleteTarget ? usageOf(deleteTarget.id) : undefined}
        isPending={deleteTeacher.isPending}
        onConfirm={() => {
          if (deleteTarget) {
            deleteTeacher.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
          }
        }}
      />
    </div>
  )
}
