import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { WeeklyRequirementsEditor } from "@/components/features/classes/WeeklyRequirementsEditor"
import { useCreateClass, useUpdateClass } from "@/hooks/useClasses"
import { useDays, usePeriods } from "@/hooks/usePeriods"
import { useSubjects } from "@/hooks/useSubjects"
import { useTeachers } from "@/hooks/useTeachers"
import type { SchoolClass } from "@/types"

const classSchema = z.object({
  grade: z.coerce.number().int().min(1, "Must be 1-12").max(12, "Must be 1-12"),
  section: z.string().trim().min(1, "Section is required").max(5),
  strength: z.coerce.number().int().min(1, "Must be at least 1").max(200),
  class_teacher_id: z.string(), // "" = none, else numeric id as string (Select works with strings)
})

// See TeacherFormSheet.tsx for why z.coerce fields need both input and
// output generics passed to useForm.
type ClassFormInput = z.input<typeof classSchema>
type ClassFormValues = z.output<typeof classSchema>
const NO_TEACHER = "none"
const emptyValues: ClassFormInput = { grade: 6, section: "", strength: 40, class_teacher_id: NO_TEACHER }

interface ClassFormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  schoolClass?: SchoolClass | null
}

export function ClassFormSheet({ open, onOpenChange, schoolClass }: ClassFormSheetProps) {
  const { data: teachers = [] } = useTeachers()
  const { data: subjects = [] } = useSubjects()
  const createClass = useCreateClass()
  const updateClass = useUpdateClass()

  const isEditing = !!schoolClass
  const isPending = createClass.isPending || updateClass.isPending

  const form = useForm<ClassFormInput, unknown, ClassFormValues>({ resolver: zodResolver(classSchema), defaultValues: emptyValues })

  useEffect(() => {
    if (open) {
      form.reset(
        schoolClass
          ? {
              grade: schoolClass.grade,
              section: schoolClass.section,
              strength: schoolClass.strength,
              class_teacher_id: schoolClass.class_teacher_id ? String(schoolClass.class_teacher_id) : NO_TEACHER,
            }
          : emptyValues,
      )
    }
  }, [open, schoolClass, form])

  const onSubmit = async (values: ClassFormValues) => {
    const input = {
      grade: values.grade,
      section: values.section.toUpperCase(),
      strength: values.strength,
      class_teacher_id: values.class_teacher_id !== NO_TEACHER ? Number(values.class_teacher_id) : null,
    }
    if (isEditing) await updateClass.mutateAsync({ id: schoolClass.id, input })
    else await createClass.mutateAsync(input)
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit class" : "Add class"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Update this class's details and weekly subject periods." : "Add a new grade and section."}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="grade"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Grade</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={12} {...field} value={field.value as number} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="section"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Section</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. A" className="uppercase" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="strength"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Number of students</FormLabel>
                  <FormControl>
                    <Input type="number" min={1} max={200} {...field} value={field.value as number} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="class_teacher_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Class teacher</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="No class teacher assigned" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_TEACHER}>No class teacher assigned</SelectItem>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <SheetFooter className="px-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditing ? "Save changes" : "Add class"}
              </Button>
            </SheetFooter>
          </form>
        </Form>

        {isEditing && (
          <div className="px-4 pb-4">
            <Separator className="mb-4" />
            <h3 className="text-sm font-semibold mb-3">Weekly subject periods</h3>
            <ClassRequirementsSection classId={schoolClass.id} subjects={subjects} />
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

function ClassRequirementsSection({
  classId,
  subjects,
}: {
  classId: number
  subjects: { id: number; name: string; code: string; is_lab: boolean }[]
}) {
  const { data: days = [] } = useDays()
  const { data: periods = [] } = usePeriods()
  const teachingPeriods = periods.filter((p) => !p.is_break)
  const totalSlots = days.length * teachingPeriods.length

  return <WeeklyRequirementsEditor classId={classId} subjects={subjects} totalSlots={totalSlots || 48} />
}
