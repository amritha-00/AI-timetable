import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import { bottomNav, footerNav, mainNav, setupNav, type NavItem } from "./nav-items"

function Row({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive ? "bg-accent text-accent-foreground" : "text-foreground/70 hover:bg-accent/60 hover:text-foreground",
        )
      }
    >
      <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <span>{item.label}</span>
    </NavLink>
  )
}

/** Same destinations as the desktop Sidebar, rendered inside a Sheet for
 * screens under the md breakpoint (see TopBar.tsx). */
export function MobileNav() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-border">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground font-semibold text-sm">
          T
        </div>
        <span className="font-semibold text-sm">School Timetable AI</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-5">
        <nav className="flex flex-col gap-0.5">
          {mainNav.map((item) => <Row key={item.to} item={item} />)}
        </nav>
        <div>
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/40">Setup</p>
          <nav className="flex flex-col gap-0.5">
            {setupNav.map((item) => <Row key={item.to} item={item} />)}
          </nav>
        </div>
        <nav className="flex flex-col gap-0.5">
          {bottomNav.map((item) => <Row key={item.to} item={item} />)}
        </nav>
      </div>
      <div className="border-t border-border px-2 py-2">
        <nav className="flex flex-col gap-0.5">
          {footerNav.map((item) => <Row key={item.to} item={item} />)}
        </nav>
      </div>
    </div>
  )
}
