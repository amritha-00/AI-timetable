import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { useCreateSubject, useUpdateSubject } from "@/hooks/useSubjects"
import type { Subject } from "@/types"

const subjectSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  code: z
    .string()
    .trim()
    .min(1, "Code is required")
    .max(20)
    .regex(/^[A-Za-z0-9]+$/, "Letters and numbers only"),
  is_lab: z.boolean(),
})

type SubjectFormValues = z.infer<typeof subjectSchema>
const emptyValues: SubjectFormValues = { name: "", code: "", is_lab: false }

interface SubjectFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  subject?: Subject | null
}

export function SubjectFormSheet({ open, onOpenChange, subject }: SubjectFormSheetProps) {
  const createSubject = useCreateSubject()
  const updateSubject = useUpdateSubject()
  const isEditing = !!subject
  const isPending = createSubject.isPending || updateSubject.isPending

  const form = useForm<SubjectFormValues>({ resolver: zodResolver(subjectSchema), defaultValues: emptyValues })

  useEffect(() => {
    if (open) {
      form.reset(subject ? { name: subject.name, code: subject.code, is_lab: subject.is_lab } : emptyValues)
    }
  }, [open, subject, form])

  const onSubmit = async (values: SubjectFormValues) => {
    const input = { ...values, code: values.code.toUpperCase() }
    if (isEditing) await updateSubject.mutateAsync({ id: subject.id, input })
    else await createSubject.mutateAsync(input)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit subject" : "Add subject"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Update this subject's details." : "Add a new subject to your curriculum."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 pb-4 space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subject name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Mathematics" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short code</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. MATH" className="font-mono uppercase" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_lab"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <FormLabel>Lab subject</FormLabel>
                    <p className="text-xs text-muted-foreground mt-0.5">Requires a lab room when scheduled.</p>
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
                {isPending ? "Saving..." : isEditing ? "Save changes" : "Add subject"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
