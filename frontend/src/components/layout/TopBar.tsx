import { LogOut, Menu, Moon, Sparkles, Sun, User } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { useAuth } from "@/hooks/useAuth"
import { useTheme } from "@/hooks/useTheme"
import { SetupProgressBadge } from "@/components/features/dashboard/SetupProgressBadge"
import { usingMocks } from "@/lib/api/client"
import { MobileNav } from "./MobileNav"

const ACADEMIC_YEARS = ["2025-2026", "2026-2027"]

export function TopBar() {
  const { theme, toggleTheme } = useTheme()
  const { tenant, logout } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-4 md:px-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation menu">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <MobileNav />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex items-center gap-3 min-w-0">
        <SetupProgressBadge />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex font-mono text-xs">
            {ACADEMIC_YEARS[0]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {ACADEMIC_YEARS.map((year) => (
            <DropdownMenuItem key={year} className="font-mono text-xs">
              {year}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </Button>

      {tenant && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Account">
              <User className="h-[18px] w-[18px]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="truncate">{tenant.school_name}</DropdownMenuLabel>
            <div className="px-2 pb-2 text-xs text-muted-foreground truncate">{tenant.email}</div>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              {usingMocks() ? (
                <Badge variant="secondary">Demo mode</Badge>
              ) : tenant.is_subscribed ? (
                <Badge variant="secondary">Unlimited plan</Badge>
              ) : (
                <div className="space-y-1.5">
                  <Badge variant={tenant.trial_generations_remaining === 0 ? "destructive" : "outline"}>
                    {tenant.trial_generations_remaining} of 3 free generations left
                  </Badge>
                  <DropdownMenuItem onSelect={() => navigate("/settings")} className="gap-2">
                    <Sparkles className="h-4 w-4" /> Upgrade plan
                  </DropdownMenuItem>
                </div>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={logout} className="gap-2">
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  )
}
