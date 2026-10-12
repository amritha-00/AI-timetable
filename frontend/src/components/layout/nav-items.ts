import {
  CalendarRange,
  Clock,
  DoorOpen,
  GraduationCap,
  LayoutDashboard,
  MessagesSquare,
  School,
  Settings,
  Sparkles,
  Users,
} from "lucide-react"

export interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
}

export const mainNav: NavItem[] = [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, end: true }]

export const setupNav: NavItem[] = [
  { to: "/setup/teachers", label: "Teachers", icon: Users },
  { to: "/setup/subjects", label: "Subjects", icon: GraduationCap },
  { to: "/setup/classes", label: "Classes", icon: School },
  { to: "/setup/rooms", label: "Rooms", icon: DoorOpen },
  { to: "/setup/periods", label: "Periods", icon: Clock },
]

export const bottomNav: NavItem[] = [
  { to: "/constraints", label: "Constraints", icon: MessagesSquare },
  { to: "/generate", label: "Generate", icon: Sparkles },
  { to: "/timetables", label: "Timetables", icon: CalendarRange },
]

export const footerNav: NavItem[] = [{ to: "/settings", label: "Settings", icon: Settings }]
