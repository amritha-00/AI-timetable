import { Clock, Pencil, Plus, Trash2 } from "lucide-react"
import { useMemo, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DeleteConfirmDialog } from "@/components/features/shared/DeleteConfirmDialog"
import { EmptyState } from "@/components/features/shared/EmptyState"
import { PeriodFormSheet } from "@/components/features/periods/PeriodFormSheet"
import { WorkingDaysSection } from "@/components/features/periods/WorkingDaysSection"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeletePeriod, usePeriods } from "@/hooks/usePeriods"
import type { Period } from "@/types"

export default function PeriodsPage() {
  const { data: periods = [], isLoading } = usePeriods()
  const deletePeriod = useDeletePeriod()

  const [formOpen, setFormOpen] = useState(false)
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Period | null>(null)

  const sorted = useMemo(
    () => [...periods].sort((a, b) => a.start_time.localeCompare(b.start_time)),
    [periods],
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Periods</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your school's daily period schedule and breaks.</p>
        </div>
        <Button
          onClick={() => {
            setEditingPeriod(null)
            setFormOpen(true)
          }}
        >
          <Plus className="h-4 w-4" /> Add period
        </Button>
      </div>

      <WorkingDaysSection />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="No periods yet"
          description="Set up your school's daily schedule, including any breaks."
          action={
            <Button
              onClick={() => {
                setEditingPeriod(null)
                setFormOpen(true)
              }}
            >
              <Plus className="h-4 w-4" /> Add your first period
            </Button>
          }
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((period) => (
                <TableRow key={period.id}>
                  <TableCell className="font-medium">{period.is_break ? "-" : period.period_number}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {period.start_time.slice(0, 5)} - {period.end_time.slice(0, 5)}
                  </TableCell>
                  <TableCell>{period.label ?? <span className="text-muted-foreground">-</span>}</TableCell>
                  <TableCell>
                    {period.is_break ? (
                      <Badge variant="secondary">Break</Badge>
                    ) : (
                      <Badge className="bg-success/15 text-success border-transparent">Teaching</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        aria-label={`Edit period ${period.period_number}`}
                        onClick={() => {
                          setEditingPeriod(period)
                          setFormOpen(true)
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label={`Delete period ${period.period_number}`}
                        onClick={() => setDeleteTarget(period)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PeriodFormSheet open={formOpen} onOpenChange={setFormOpen} period={editingPeriod} />

      <DeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        itemLabel={deleteTarget ? deleteTarget.label ?? `Period ${deleteTarget.period_number}` : ""}
        usageWarning="Existing generated timetables reference this period and may need to be regenerated."
        isPending={deletePeriod.isPending}
        onConfirm={() => {
          if (deleteTarget) deletePeriod.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })
        }}
      />
    </div>
  )
}
