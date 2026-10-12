import { DoorOpen, GraduationCap, School, ShieldCheck, Users } from "lucide-react"
import { FreshInstallEmptyState } from "@/components/features/dashboard/FreshInstallEmptyState"
import { LatestTimetableCard } from "@/components/features/dashboard/LatestTimetableCard"
import { SetupChecklist } from "@/components/features/dashboard/SetupChecklist"
import { StatCard } from "@/components/features/dashboard/StatCard"
import { useClasses } from "@/hooks/useClasses"
import { useConstraints } from "@/hooks/useConstraints"
import { useRooms } from "@/hooks/useRooms"
import { useSubjects } from "@/hooks/useSubjects"
import { useTeachers } from "@/hooks/useTeachers"

export default function Dashboard() {
  const teachers = useTeachers()
  const subjects = useSubjects()
  const classes = useClasses()
  const rooms = useRooms()
  const constraints = useConstraints(true)

  const nothingSetUp =
    !teachers.isLoading &&
    !subjects.isLoading &&
    !classes.isLoading &&
    (teachers.data?.length ?? 0) === 0 &&
    (subjects.data?.length ?? 0) === 0 &&
    (classes.data?.length ?? 0) === 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">An overview of your school's timetable setup.</p>
      </div>

      {nothingSetUp ? (
        <FreshInstallEmptyState />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <StatCard label="Teachers" value={teachers.data?.length} icon={Users} href="/setup/teachers" isLoading={teachers.isLoading} />
            <StatCard label="Subjects" value={subjects.data?.length} icon={GraduationCap} href="/setup/subjects" isLoading={subjects.isLoading} />
            <StatCard label="Classes" value={classes.data?.length} icon={School} href="/setup/classes" isLoading={classes.isLoading} />
            <StatCard label="Rooms" value={rooms.data?.length} icon={DoorOpen} href="/setup/rooms" isLoading={rooms.isLoading} />
            <StatCard label="Active constraints" value={constraints.data?.length} icon={ShieldCheck} href="/constraints" isLoading={constraints.isLoading} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <SetupChecklist />
            </div>
            <LatestTimetableCard />
          </div>
        </>
      )}
    </div>
  )
}
