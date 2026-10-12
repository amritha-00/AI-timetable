import { CompassIcon } from "lucide-react"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <CompassIcon className="h-10 w-10 text-muted-foreground mb-4" aria-hidden="true" />
      <h1 className="text-xl font-semibold">Page not found</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">The page you're looking for doesn't exist.</p>
      <Button asChild className="mt-5">
        <Link to="/">Back to Dashboard</Link>
      </Button>
    </div>
  )
}
