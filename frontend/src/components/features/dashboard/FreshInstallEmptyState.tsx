import { useQueryClient } from "@tanstack/react-query"
import { School, Sparkles, Users } from "lucide-react"
import { toast } from "sonner"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { loadDemoSchool } from "@/lib/demoSchool"

export function FreshInstallEmptyState() {
  const queryClient = useQueryClient()

  const handleLoadDemo = () => {
    loadDemoSchool()
    queryClient.invalidateQueries()
    toast.success("Demo school loaded", {
      description: "20 teachers, 10 subjects, 10 classes and more - ready to explore.",
    })
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-5">
        <School className="h-7 w-7" aria-hidden="true" />
      </div>
      <h1 className="text-xl font-semibold">Let's set up your school</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Add your teachers, subjects, classes, and rooms, describe scheduling rules in plain English, and generate a
        clash-free timetable in minutes.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link to="/setup/teachers">
            <Users className="h-4 w-4" /> Add your first teacher
          </Link>
        </Button>
        <Button variant="outline" onClick={handleLoadDemo}>
          <Sparkles className="h-4 w-4" /> Load demo school
        </Button>
      </div>
    </div>
  )
}
