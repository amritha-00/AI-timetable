import { useClasses } from "./useClasses"
import { useDays } from "./usePeriods"
import { useRequirements } from "./useRequirements"
import { useRooms } from "./useRooms"
import { useSubjects } from "./useSubjects"
import { useTeachers } from "./useTeachers"
import type { SetupStep } from "@/types"

/** Derives the dashboard's setup checklist client-side from the four roster
 * queries plus requirements - there's no dedicated backend endpoint for
 * "is setup done", so this is computed from what's already being fetched
 * elsewhere, kept in one place so the checklist and the "can I generate a
 * timetable yet" logic never disagree. */
export function useSetupSteps() {
  const teachers = useTeachers()
  const subjects = useSubjects()
  const classes = useClasses()
  const rooms = useRooms()
  const days = useDays()
  const requirements = useRequirements()

  const isLoading =
    teachers.isLoading || subjects.isLoading || classes.isLoading || rooms.isLoading || days.isLoading || requirements.isLoading

  const steps: SetupStep[] = [
    { key: "teachers", label: "Add teachers", done: (teachers.data?.length ?? 0) > 0, count: teachers.data?.length ?? 0, href: "/setup/teachers" },
    { key: "subjects", label: "Add subjects", done: (subjects.data?.length ?? 0) > 0, count: subjects.data?.length ?? 0, href: "/setup/subjects" },
    { key: "classes", label: "Add classes", done: (classes.data?.length ?? 0) > 0, count: classes.data?.length ?? 0, href: "/setup/classes" },
    { key: "rooms", label: "Add rooms", done: (rooms.data?.length ?? 0) > 0, count: rooms.data?.length ?? 0, href: "/setup/rooms" },
    { key: "days", label: "Set working days", done: (days.data?.length ?? 0) > 0, count: days.data?.length ?? 0, href: "/setup/periods" },
    {
      key: "requirements",
      label: "Set periods per subject",
      done: (requirements.data?.length ?? 0) > 0,
      count: requirements.data?.length ?? 0,
      href: "/setup/classes",
    },
  ]

  const doneCount = steps.filter((s) => s.done).length

  return { steps, doneCount, total: steps.length, isComplete: doneCount === steps.length, isLoading }
}
