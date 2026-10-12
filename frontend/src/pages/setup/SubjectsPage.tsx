import type { ColumnDef } from "@tanstack/react-table"
import { GraduationCap, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CsvImportSheet } from "@/components/features/shared/CsvImportSheet"
import { DataTable } from "@/components/features/shared/DataTable"
import { DeleteConfirmDialog } from "@/components/features/shared/DeleteConfirmDialog"
import { EmptyState } from "@/components/features/shared/EmptyState"
import { SubjectFormSheet } from "@/components/features/subjects/SubjectFormSheet"
import { useRequirements } from "@/hooks/useRequirements"
import { useCreateSubject, useDeleteSubject, useSubjects } from "@/hooks/useSubjects"
import { useTeachers } from "@/hooks/useTeachers"
import type { Subject } from "@/types"

export default function SubjectsPage() {
  const { data: subjects = [], isLoading } = useSubjects()
  const { data: teachers = [] } = useTeachers()
  const { data: requirements = [] } = useRequirements()
  const createSubject = useCreateSubject()
  const deleteSubject = useDeleteSubject()

  const [formOpen, setFormOpen] = useState(false)
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null)

  const usageOf = (subjectId: number): string | undefined => {
    const teacherCount = teachers.filter((t) => t.subject_ids.includes(subjectId)).length
    const reqCount = requirements.filter((r) => r.subject_id === subjectId).length
    const parts: string[] = []
    if (teacherCount > 0) parts.push(`${teacherCount} teacher${teacherCount === 1 ? " is" : "s are"} qualified to teach it`)
    if (reqCount > 0) parts.push(`it's required by ${reqCount} class${reqCount === 1 ? "" : "es"}`)
    if (parts.length === 0) return undefined
    return `Currently ${parts.join(" and ")}. Deleting will remove these too.`
  }

  const columns: ColumnDef<Subject, unknown>[] = useMemo(
    () => [
      { accessorKey: "name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.name}</span> },
      { accessorKey: "code", header: "Code", cell: ({ row }) => <span className="font-mono text-sm">{row.original.code}</span> },
      {
        accessorKey: "is_lab",
        header: "Type",
        cell: ({ row }) =>
          row.original.is_lab ? (
            <Badge className="bg-primary/10 text-primary border-transparent">Lab</Badge>
          ) : (
            <Badge variant="secondary">Classroom</Badge>
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
                setEditingSubject(row.original)
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
          <h1 className="text-2xl font-semibold tracking-tight">Subjects</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage the subjects taught at your school.</p>
        </div>
        <Button
          onClick={() => {
            setEditingSubject(null)
            setFormOpen(true)
          }}
        >
          <Plus className="h-4 w-4" /> Add subject
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={subjects}
        isLoading={isLoading}
        searchPlaceholder="Search subjects..."
        onImportClick={() => setImportOpen(true)}
        emptyState={
          <EmptyState
            icon={GraduationCap}
            title="No subjects yet"
            description="Add the subjects taught at your school to build your curriculum."
            action={
              <Button
                onClick={() => {
                  setEditingSubject(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="h-4 w-4" /> Add your first subject
              </Button>
            }
          />
        }
      />

      <SubjectFormSheet open={formOpen} onOpenChange={setFormOpen} subject={editingSubject} />

      <CsvImportSheet
        open={importOpen}
        onOpenChange={setImportOpen}
        entityLabel="Subject"
        templateHeaders={["name", "code", "is_lab"]}
        templateSampleRows={[["Mathematics", "MATH", "false"], ["Science", "SCI", "true"]]}
        previewColumns={[
          { key: "name", label: "Name" },
          { key: "code", label: "Code" },
          { key: "is_lab", label: "Lab?" },
        ]}
        parseRow={(row) => {
          const errors: string[] = []
          const name = row.name?.trim()
          const code = row.code?.trim()
          if (!name) errors.push("Name is required")
          if (!code) errors.push("Code is required")
          if (errors.length > 0) return { data: null, errors }
          return {
            data: { name, code: code.toUpperCase(), is_lab: /^(true|yes|1)$/i.test(row.is_lab?.trim() ?? "") },
            errors: [],
          }
        }}
        onImport={async (rows) => {
          for (const row of rows) {
            await createSubject.mutateAsync(row)
          }
        }}
      />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemLabel={deleteTarget?.name ?? ""}
        usageWarning={deleteTarget ? usageOf(deleteTarget.id) : undefined}
        isPending={deleteSubject.isPending}
        onConfirm={() => {
          if (deleteTarget) deleteSubject.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
        }}
      />
    </div>
  )
}
