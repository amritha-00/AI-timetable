import { AlertTriangle } from "lucide-react"
import { Component, type ErrorInfo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
}

/** Catches render-time errors anywhere below it so one broken screen never
 * takes down the whole app shell (sidebar/top bar stay usable). Query
 * errors are handled separately, inline, per-screen (TanStack Query's
 * isError + retry) - this is only for unexpected render crashes. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive mb-4" aria-hidden="true" />
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            This page ran into a problem. Try reloading - if it keeps happening, contact support.
          </p>
          <Button className="mt-5" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
