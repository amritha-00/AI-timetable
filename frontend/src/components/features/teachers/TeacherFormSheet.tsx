import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { MultiSelectCombobox } from "@/components/features/shared/MultiSelectCombobox"
import { useSubjects } from "@/hooks/useSubjects"
import { useCreateTeacher, useSetTeacherSubjects, useUpdateTeacher } from "@/hooks/useTeachers"
import type { Teacher } from "@/types"

const teacherSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.union([z.string().trim().email("Enter a valid email address"), z.literal("")]),
  phone: z.string().trim().max(20).optional(),
  max_periods_per_day: z.coerce.number().int().min(1, "Must be at least 1").max(10, "Must be 10 or fewer"),
  is_active: z.boolean(),
  subject_ids: z.array(z.number()),
})

// z.coerce.number() makes the schema's input type (pre-coercion, what
// react-hook-form's state actually holds) differ from its output type
// (post-coercion, what the resolver hands to onSubmit) - useForm needs both
// generics or @hookform/resolvers' zod v4 typing doesn't line up.
type TeacherFormInput = z.input<typeof teacherSchema>
type TeacherFormValues = z.output<typeof teacherSchema>

const emptyValues: TeacherFormInput = {
  name: "",
  email: "",
  phone: "",
  max_periods_per_day: 6,
  is_active: true,
  subject_ids: [],
}

interface TeacherFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  teacher?: Teacher | null
}

export function TeacherFormSheet({ open, onOpenChange, teacher }: TeacherFormSheetProps) {
  const { data: subjects = [] } = useSubjects()
  const createTeacher = useCreateTeacher()
  const updateTeacher = useUpdateTeacher()
  const setSubjects = useSetTeacherSubjects()

  const isEditing = !!teacher
  const isPending = createTeacher.isPending || updateTeacher.isPending || setSubjects.isPending

  const form = useForm<TeacherFormInput, unknown, TeacherFormValues>({
    resolver: zodResolver(teacherSchema),
    defaultValues: emptyValues,
  })

  useEffect(() => {
    if (open) {
      form.reset(
        teacher
          ? {
              name: teacher.name,
              email: teacher.email ?? "",
              phone: teacher.phone ?? "",
              max_periods_per_day: teacher.max_periods_per_day,
              is_active: teacher.is_active,
              subject_ids: teacher.subject_ids,
            }
          : emptyValues,
      )
    }
  }, [open, teacher, form])

  const onSubmit = async (values: TeacherFormValues) => {
    const input = {
      name: values.name,
      email: values.email || null,
      phone: values.phone || null,
      max_periods_per_day: values.max_periods_per_day,
      is_active: values.is_active,
    }

    const saved = isEditing
      ? await updateTeacher.mutateAsync({ id: teacher.id, input })
      : await createTeacher.mutateAsync(input)

    await setSubjects.mutateAsync({ id: saved.id, subjectIds: values.subject_ids })
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit teacher" : "Add teacher"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Update this teacher's details and qualifications." : "Add a new teacher to your staff roster."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 pb-4 space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Anita Sharma" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="anita.sharma@school.edu" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="max_periods_per_day"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Maximum periods per day</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={10} {...field} value={field.value as number} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subject_ids"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Subjects this teacher can teach</FormLabel>
                  <FormControl>
                    <MultiSelectCombobox
                      options={subjects.map((s) => ({ value: s.id, label: s.name, hint: s.is_lab ? "lab" : undefined }))}
                      selected={field.value}
                      onChange={field.onChange}
                      placeholder="Select subjects..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <FormLabel>Active</FormLabel>
                    <p className="text-xs text-muted-foreground mt-0.5">Inactive teachers are excluded from scheduling.</p>
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
                {isPending ? "Saving..." : isEditing ? "Save changes" : "Add teacher"}
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
