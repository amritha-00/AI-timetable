import type { LucideIcon } from "lucide-react"

interface PagePlaceholderProps {
  icon: LucideIcon
  title: string
  description: string
  phaseNote: string
}

/** Consistent, intentional-looking stand-in for screens not built yet in
 * this phase - so routing/navigation is fully wired and demoable end to
 * end from step 1, without a page looking broken or unfinished. */
export function PagePlaceholder({ icon: Icon, title, description, phaseNote }: PagePlaceholderProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-24 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Icon className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      <p className="mt-4 text-xs font-medium text-primary">{phaseNote}</p>
    </div>
  )
}
