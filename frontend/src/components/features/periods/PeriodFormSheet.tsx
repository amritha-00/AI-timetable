import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { useCreatePeriod, useUpdatePeriod } from "@/hooks/usePeriods"
import type { Period } from "@/types"

const periodSchema = z
  .object({
    period_number: z.coerce.number().int().min(1, "Must be 1 or higher").max(15),
    start_time: z.string().min(1, "Start time is required"),
    end_time: z.string().min(1, "End time is required"),
    is_break: z.boolean(),
    label: z.string().trim().max(100).optional(),
  })
  .refine((data) => data.end_time > data.start_time, {
    message: "End time must be after start time",
    path: ["end_time"],
  })

// See TeacherFormSheet.tsx for why z.coerce fields need both input and
// output generics passed to useForm.
type PeriodFormInput = z.input<typeof periodSchema>
type PeriodFormValues = z.output<typeof periodSchema>
const emptyValues: PeriodFormInput = { period_number: 1, start_time: "08:00", end_time: "08:40", is_break: false, label: "" }

// Backend stores "HH:MM:SS"; the <input type="time"> control wants "HH:MM".
const toInputTime = (t: string) => t.slice(0, 5)
const toApiTime = (t: string) => (t.length === 5 ? `${t}:00` : t)

interface PeriodFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  period?: Period | null
}

export function PeriodFormSheet({ open, onOpenChange, period }: PeriodFormSheetProps) {
  const createPeriod = useCreatePeriod()
  const updatePeriod = useUpdatePeriod()
  const isEditing = !!period
  const isPending = createPeriod.isPending || updatePeriod.isPending

  const form = useForm<PeriodFormInput, unknown, PeriodFormValues>({ resolver: zodResolver(periodSchema), defaultValues: emptyValues })

  useEffect(() => {
    if (open) {
      form.reset(
        period
          ? {
              period_number: period.period_number,
              start_time: toInputTime(period.start_time),
              end_time: toInputTime(period.end_time),
              is_break: period.is_break,
              label: period.label ?? "",
            }
          : emptyValues,
      )
    }
  }, [open, period, form])

  const onSubmit = async (values: PeriodFormValues) => {
    const input = {
      period_number: values.period_number,
      start_time: toApiTime(values.start_time),
      end_time: toApiTime(values.end_time),
      is_break: values.is_break,
      label: values.label || null,
    }
    if (isEditing) await updatePeriod.mutateAsync({ id: period.id, input })
    else await createPeriod.mutateAsync(input)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit period" : "Add period"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Update this period's timing." : "Add a period or break to the daily schedule."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 pb-4 space-y-4">
            <FormField
              control={form.control}
              name="period_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Period number</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={15} {...field} value={field.value as number} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start time</FormLabel>
                    <FormControl>
                      <Input type="time" className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End time</FormLabel>
                    <FormControl>
                      <Input type="time" className="font-mono" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Period 1 or Lunch Break" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_break"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <FormLabel>This is a break</FormLabel>
                    <p className="text-xs text-muted-foreground mt-0.5">Break periods are never scheduled with classes.</p>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditing ? "Save changes" : "Add period"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
