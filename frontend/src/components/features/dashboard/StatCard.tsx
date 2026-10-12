import type { LucideIcon } from "lucide-react"
import { Link } from "react-router-dom"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: number | undefined
  icon: LucideIcon
  href?: string
  isLoading?: boolean
}

export function StatCard({ label, value, icon: Icon, href, isLoading }: StatCardProps) {
  const content = (
    <Card className={cn("p-4 flex items-center gap-3.5 transition-colors duration-150", href && "hover:border-primary/40")}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
        {isLoading ? (
          <Skeleton className="h-6 w-10 mt-1" />
        ) : (
          <p className="text-xl font-semibold tabular-nums">{value ?? 0}</p>
        )}
      </div>
    </Card>
  )

  if (!href) return content
  return (
    <Link to={href} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {content}
    </Link>
  )
}
