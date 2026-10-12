import { ChevronLeft, ChevronRight } from "lucide-react"
import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { bottomNav, footerNav, mainNav, setupNav, type NavItem } from "./nav-items"

function NavRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const link = (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          collapsed && "justify-center px-2",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )
      }
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  )

  if (!collapsed) return link

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right">{item.label}</TooltipContent>
    </Tooltip>
  )
}

function NavGroup({ items, collapsed }: { items: NavItem[]; collapsed: boolean }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => (
        <NavRow key={item.to} item={item} collapsed={collapsed} />
      ))}
    </nav>
  )
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        "hidden md:flex h-svh shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-64",
      )}
    >
      <div className={cn("flex items-center gap-2 px-4 py-4", collapsed && "justify-center px-2")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm">
          T
        </div>
        {!collapsed && (
          <span className="truncate font-semibold text-sidebar-foreground text-sm">School Timetable AI</span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-5">
        <NavGroup items={mainNav} collapsed={collapsed} />

        <div>
          {!collapsed && (
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-sidebar-foreground/40">
              Setup
            </p>
          )}
          <NavGroup items={setupNav} collapsed={collapsed} />
        </div>

        <NavGroup items={bottomNav} collapsed={collapsed} />
      </div>

      <div className="border-t border-sidebar-border px-2 py-2 flex flex-col gap-0.5">
        <NavGroup items={footerNav} collapsed={collapsed} />
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/60",
            "hover:bg-sidebar-accent/60 hover:text-sidebar-foreground transition-colors duration-150",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            collapsed && "justify-center px-2",
          )}
        >
          {collapsed ? <ChevronRight className="h-[18px] w-[18px]" /> : <ChevronLeft className="h-[18px] w-[18px]" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
