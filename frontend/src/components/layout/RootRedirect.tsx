import { Navigate } from "react-router-dom"
import { Loader2 } from "lucide-react"
import { useAuth } from "@/hooks/useAuth"
import LandingPage from "@/pages/Landing"

/** "/" is the public marketing page for a signed-out visitor, and an
 * instant redirect to the app for a signed-in one - so a returning admin
 * never has to click past their own landing page. */
export function RootRedirect() {
  const { isAuthed, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }
  if (isAuthed) return <Navigate to="/dashboard" replace />
  return <LandingPage />
}
