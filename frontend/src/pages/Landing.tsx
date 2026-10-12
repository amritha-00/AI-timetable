import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  MessagesSquare,
  MousePointerClick,
  Sparkles,
  Wand2,
} from "lucide-react"
import { Button } from "@/components/ui/button"

/** Mini animated week grid used as the hero's visual centerpiece - cells
 * light up on a staggered loop so the page feels alive without any JS
 * animation library. */
function AnimatedGrid() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"]
  const rows = 5
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {Array.from({ length: rows }).map((_, r) =>
        days.map((_, c) => {
          const i = r * days.length + c
          return (
            <div
              key={i}
              className="landing-cell h-7 w-10 rounded-md sm:h-8 sm:w-12"
              style={{ animationDelay: `${(i % 11) * 0.18}s` }}
            />
          )
        }),
      )}
    </div>
  )
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${shown ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"} ${className}`}
    >
      {children}
    </div>
  )
}

const STEPS = [
  {
    icon: MessagesSquare,
    title: "Tell it the rules",
    text: "“Mrs. Rao can't teach Friday afternoons.” Type scheduling rules like a chat message - the AI turns them into structured constraints and asks when something's unclear.",
  },
  {
    icon: Wand2,
    title: "Let the solver work",
    text: "A constraint solver checks every teacher, room and class against every rule at once, and builds a clash-free timetable in seconds.",
  },
  {
    icon: MousePointerClick,
    title: "Fine-tune by dragging",
    text: "Drag any lesson to a new slot. Clashing drops turn red before you even let go, so you can't break the timetable by accident.",
  },
]

const FEATURES = [
  "Plain-English constraint chat, not a form to fill out",
  "Class, teacher and room views of the same timetable",
  "Drag-and-drop editing with live clash detection",
  "Excel, PDF and print-ready exports",
  "Hard vs. soft rules, with a plain percentage of what's followed",
  "Each school's data is fully private to that school",
]

export default function LandingPage() {
  return (
    <div className="landing-page min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <div className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <CalendarRange className="h-4 w-4" />
          </span>
          Timetable AI
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/login">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/signup">Get started</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 sm:pt-16">
        <div className="landing-blob landing-blob-a" />
        <div className="landing-blob landing-blob-b" />

        <div className="relative grid items-center gap-12 lg:grid-cols-2">
          <div className="landing-in space-y-6">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> AI-assisted scheduling for schools
            </div>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Build your school's timetable by <span className="text-primary">talking to it</span>.
            </h1>
            <p className="max-w-lg text-lg text-muted-foreground">
              Describe your scheduling rules in plain English. A real constraint solver turns them, your teachers,
              rooms and classes into a clash-free weekly timetable - ready to drag, tweak and export.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button asChild size="lg">
                <Link to="/signup">
                  Let's do it <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/login">I already have an account</Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">3 free timetable generations. No card required.</p>
          </div>

          <div className="landing-in landing-in-delay relative mx-auto w-full max-w-sm">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-xl shadow-primary/5">
              <div className="mb-4 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Grade 8 - A</span>
                <span className="flex items-center gap-1 text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> No clashes
                </span>
              </div>
              <AnimatedGrid />
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
                <MessagesSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="landing-type">Science labs must be in a lab room</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
            Three steps from rules to timetable
          </h2>
        </Reveal>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} className={i === 1 ? "sm:translate-y-4" : ""}>
              <div className="h-full rounded-xl border border-border bg-card p-6 transition-transform hover:-translate-y-1">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </div>
                <h3 className="font-medium">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.text}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <div className="rounded-2xl border border-border bg-card p-8 sm:p-10">
            <div className="grid gap-8 sm:grid-cols-2 sm:items-center">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">Built for the whole scheduling workflow</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Not just a solver - a complete front-to-back tool for the person who actually has to produce the
                  timetable every term.
                </p>
              </div>
              <ul className="space-y-2.5">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-2xl bg-primary px-8 py-14 text-center text-primary-foreground sm:py-16">
            <div className="landing-blob landing-blob-c" />
            <h2 className="relative text-2xl font-semibold tracking-tight sm:text-3xl">
              Ready to stop fighting spreadsheets?
            </h2>
            <p className="relative mx-auto mt-2 max-w-md text-sm opacity-90">
              Set up your school, describe your rules, and generate your first timetable in minutes.
            </p>
            <Button asChild size="lg" variant="secondary" className="relative mt-6">
              <Link to="/signup">
                Let's do it <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </Reveal>
      </section>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-center text-xs text-muted-foreground sm:px-6">
        AI School Timetable Generator - a portfolio project.
      </footer>
    </div>
  )
}
