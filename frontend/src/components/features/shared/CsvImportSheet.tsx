import Papa from "papaparse"
import { AlertCircle, CheckCircle2, Download, FileUp } from "lucide-react"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

export interface ParsedRow<T> {
  rowNumber: number
  raw: Record<string, string>
  data: T | null
  errors: string[]
}

interface CsvImportSheetProps<T> {
  open: boolean
  onOpenChange: (open: boolean) => void
  entityLabel: string
  templateHeaders: string[]
  templateSampleRows: string[][]
  /** Validates + transforms one raw CSV row. Return `data: null` with at
   * least one error message to reject the row - it's excluded from import
   * but still shown in the preview so the admin can see what to fix. */
  parseRow: (row: Record<string, string>) => { data: T | null; errors: string[] }
  previewColumns: { key: string; label: string }[]
  onImport: (rows: T[]) => Promise<void>
}

/**
 * Shared bulk CSV import flow: download a template, pick a file, see a
 * per-row validated preview, then confirm. Every Setup screen gets this via
 * the same component - only `parseRow`/`templateHeaders` differ per entity.
 */
export function CsvImportSheet<T>({
  open,
  onOpenChange,
  entityLabel,
  templateHeaders,
  templateSampleRows,
  parseRow,
  previewColumns,
  onImport,
}: CsvImportSheetProps<T>) {
  const [rows, setRows] = useState<ParsedRow<T>[]>([])
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validCount = rows.filter((r) => r.data !== null).length
  const invalidCount = rows.length - validCount

  const reset = () => {
    setRows([])
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const downloadTemplate = () => {
    const csv = Papa.unparse({ fields: templateHeaders, data: templateSampleRows })
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${entityLabel.toLowerCase().replace(/\s+/g, "_")}_template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results.data.map((raw, i) => {
          const { data, errors } = parseRow(raw)
          return { rowNumber: i + 2, raw, data, errors } // +2: header row + 1-indexing
        })
        setRows(parsed)
      },
      error: (err) => toast.error(`Couldn't read that file: ${err.message}`),
    })
  }

  const handleImport = async () => {
    const validRows = rows.filter((r): r is ParsedRow<T> & { data: T } => r.data !== null).map((r) => r.data)
    if (validRows.length === 0) return
    setImporting(true)
    try {
      await onImport(validRows)
      toast.success(`Imported ${validRows.length} ${entityLabel.toLowerCase()}${validRows.length === 1 ? "" : "s"}`)
      reset()
      onOpenChange(false)
    } catch {
      toast.error("Some rows couldn't be imported. Please try again.")
    } finally {
      setImporting(false)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Import {entityLabel}s from CSV</SheetTitle>
          <SheetDescription>
            Download the template, fill it in, then upload it here. You'll see exactly which rows are valid before
            anything is saved.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-4">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4" /> Download template
          </Button>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFile(file)
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-8 text-sm text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FileUp className="h-6 w-6" aria-hidden="true" />
              {rows.length > 0 ? "Choose a different file" : "Click to choose a CSV file"}
            </button>
          </div>

          {rows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-success">
                  <CheckCircle2 className="h-4 w-4" /> {validCount} valid
                </span>
                {invalidCount > 0 && (
                  <span className="flex items-center gap-1.5 text-destructive">
                    <AlertCircle className="h-4 w-4" /> {invalidCount} need fixing
                  </span>
                )}
              </div>

              <div className="rounded-lg border border-border overflow-x-auto max-h-80 overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Row</TableHead>
                      {previewColumns.map((c) => (
                        <TableHead key={c.key}>{c.label}</TableHead>
                      ))}
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.rowNumber} className={cn(!row.data && "bg-destructive/5")}>
                        <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
                        {previewColumns.map((c) => (
                          <TableCell key={c.key}>{row.raw[c.key] ?? ""}</TableCell>
                        ))}
                        <TableCell>
                          {row.data ? (
                            <span className="text-success text-xs">Valid</span>
                          ) : (
                            <span className="text-destructive text-xs">{row.errors.join("; ")}</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={validCount === 0 || importing}>
            {importing ? "Importing..." : `Import ${validCount || ""} ${entityLabel.toLowerCase()}${validCount === 1 ? "" : "s"}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
