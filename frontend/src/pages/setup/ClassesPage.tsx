import type { ColumnDef } from "@tanstack/react-table"
import { Pencil, Plus, School, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { ClassFormSheet } from "@/components/features/classes/ClassFormSheet"
import { CsvImportSheet } from "@/components/features/shared/CsvImportSheet"
import { DataTable } from "@/components/features/shared/DataTable"
import { DeleteConfirmDialog } from "@/components/features/shared/DeleteConfirmDialog"
import { EmptyState } from "@/components/features/shared/EmptyState"
import { useCreateClass, useDeleteClass, useClasses } from "@/hooks/useClasses"
import { useRequirements } from "@/hooks/useRequirements"
import { useTeachers } from "@/hooks/useTeachers"
import type { SchoolClass } from "@/types"

export default function ClassesPage() {
  const { data: classes = [], isLoading } = useClasses()
  const { data: teachers = [] } = useTeachers()
  const { data: requirements = [] } = useRequirements()
  const createClass = useCreateClass()
  const deleteClass = useDeleteClass()

  const [formOpen, setFormOpen] = useState(false)
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SchoolClass | null>(null)

  const teacherByName = useMemo(() => new Map(teachers.map((t) => [t.name.toLowerCase(), t])), [teachers])

  const usageOf = (classId: number): string | undefined => {
    const count = requirements.filter((r) => r.class_id === classId).length
    if (count === 0) return undefined
    return `This class has ${count} subject requirement${count === 1 ? "" : "s"} set. Deleting will remove them too.`
  }

  const columns: ColumnDef<SchoolClass, unknown>[] = useMemo(
    () => [
      {
        accessorKey: "display_name",
        header: "Class",
        cell: ({ row }) => <span className="font-medium">{row.original.display_name}</span>,
      },
      { accessorKey: "strength", header: "Students", cell: ({ row }) => <span className="font-mono text-sm">{row.original.strength}</span> },
      {
        accessorKey: "class_teacher_name",
        header: "Class teacher",
        cell: ({ row }) => row.original.class_teacher_name ?? <span className="text-muted-foreground">Not assigned</span>,
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
              aria-label={`Edit ${row.original.display_name}`}
              onClick={() => {
                setEditingClass(row.original)
                setFormOpen(true)
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              aria-label={`Delete ${row.original.display_name}`}
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
          <h1 className="text-2xl font-semibold tracking-tight">Classes</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage grades, sections, and their weekly subject requirements.</p>
        </div>
        <Button
          onClick={() => {
            setEditingClass(null)
            setFormOpen(true)
          }}
        >
          <Plus className="h-4 w-4" /> Add class
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={classes}
        isLoading={isLoading}
        searchPlaceholder="Search classes..."
        onImportClick={() => setImportOpen(true)}
        emptyState={
          <EmptyState
            icon={School}
            title="No classes yet"
            description="Add grades and sections, then set how many periods per week each subject needs."
            action={
              <Button
                onClick={() => {
                  setEditingClass(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="h-4 w-4" /> Add your first class
              </Button>
            }
          />
        }
      />

      <ClassFormSheet open={formOpen} onOpenChange={setFormOpen} schoolClass={editingClass} />

      <CsvImportSheet
        open={importOpen}
        onOpenChange={setImportOpen}
        entityLabel="Class"
        templateHeaders={["grade", "section", "strength", "class_teacher"]}
        templateSampleRows={[["6", "A", "42", "Anita Sharma"]]}
        previewColumns={[
          { key: "grade", label: "Grade" },
          { key: "section", label: "Section" },
          { key: "strength", label: "Students" },
          { key: "class_teacher", label: "Class teacher" },
        ]}
        parseRow={(row) => {
          const errors: string[] = []
          const grade = Number(row.grade)
          const section = row.section?.trim()
          const strength = Number(row.strength || 40)
          if (!Number.isFinite(grade) || grade < 1 || grade > 12) errors.push("Grade must be 1-12")
          if (!section) errors.push("Section is required")
          if (!Number.isFinite(strength) || strength < 1) errors.push("Students must be a positive number")
          const teacherName = row.class_teacher?.trim().toLowerCase()
          const teacher = teacherName ? teacherByName.get(teacherName) : undefined
          if (teacherName && !teacher) errors.push(`Unknown class teacher "${row.class_teacher}"`)
          if (errors.length > 0) return { data: null, errors }
          return {
            data: { grade, section: section.toUpperCase(), strength, class_teacher_id: teacher?.id ?? null },
            errors: [],
          }
        }}
        onImport={async (rows) => {
          for (const row of rows) {
            await createClass.mutateAsync(row)
          }
        }}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemLabel={deleteTarget?.display_name ?? ""}
        usageWarning={deleteTarget ? usageOf(deleteTarget.id) : undefined}
        isPending={deleteClass.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteClass.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
        }}
      />
    </div>
  )
}
