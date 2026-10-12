import { NavLink, Outlet, useLocation } from 'react-router-dom'

const navItems = [
  { to: '/', label: 'Data', end: true },
  { to: '/constraints', label: 'Constraints' },
  { to: '/generate', label: 'Generate' },
  { to: '/viewer', label: 'Timetable' },
]

export default function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-brand-700 text-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center font-bold text-lg">
              T
            </div>
            <span className="font-semibold text-lg tracking-tight">School Timetable AI</span>
          </div>
          <nav className="flex gap-1 ml-auto">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                    isActive ? 'bg-white text-brand-700 shadow-sm' : 'text-brand-50 hover:bg-white/10'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {/* Keying on the route path remounts the page on navigation, which
            re-triggers its entrance animation - a lightweight page-transition
            effect without a dedicated animation library. */}
        <div key={location.pathname} className="animate-fade-in-up">
          <Outlet />
        </div>
      </main>
      <footer className="text-center text-xs text-slate-400 py-4">
        AI-Powered School Timetable Generator &middot; CP-SAT solver + LLM constraint layer
      </footer>
    </div>
  )
}
