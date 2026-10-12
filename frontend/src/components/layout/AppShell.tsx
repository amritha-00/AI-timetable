import { Outlet } from "react-router-dom"
import { Toaster } from "@/components/ui/sonner"
import { useSidebarCollapsed } from "@/hooks/useSidebarCollapsed"
import { Sidebar } from "./Sidebar"
import { TopBar } from "./TopBar"

export function AppShell() {
  const { collapsed, toggle } = useSidebarCollapsed()

  return (
    <div className="flex h-svh w-full overflow-hidden bg-background text-foreground">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
      <Toaster position="bottom-right" richColors closeButton />
    </div>
  )
}
