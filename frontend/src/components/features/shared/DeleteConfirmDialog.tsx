import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface DeleteConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  itemLabel: string
  /** If set, shown as an extra warning - e.g. "Used in 6 requirements and
   * 1 class's homeroom assignment." Pass undefined when nothing references it. */
  usageWarning?: string
  onConfirm: () => void
  isPending?: boolean
}

export function DeleteConfirmDialog({
  open,
  onOpenChange,
  itemLabel,
  usageWarning,
  onConfirm,
  isPending,
}: DeleteConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {itemLabel}?</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>This can't be undone.</p>
              {usageWarning && (
                <p className="rounded-md bg-warning/10 text-warning px-3 py-2 text-sm font-medium">
                  {usageWarning}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={isPending}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
