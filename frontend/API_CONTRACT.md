# API Contract

This is the exact contract the frontend expects from the backend, matching
`backend/app/routers/*.py` and `backend/app/schemas/*.py` in this repo
field-for-field. Every type in `src/types/index.ts` mirrors this directly, so
turning `VITE_USE_MOCKS` off requires no mapping/adapter code - the mock
layer (`src/lib/api/mocks/`) and the real API are structurally
interchangeable.

Base URL: `VITE_API_URL` (default `http://localhost:8000/api`). All bodies
are JSON. All list endpoints return a plain JSON array (no pagination
envelope). Errors return `{"detail": "plain-English message" | [...]}` with
a 4xx/5xx status - `toFriendlyErrorMessage()` in `src/lib/api/client.ts` is
the single place that turns this into UI copy.

## Teachers

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/teachers?active_only=false` | - | `Teacher[]` |
| GET | `/teachers/{id}` | - | `Teacher` |
| POST | `/teachers` | `TeacherInput` | `Teacher` (201) |
| PUT | `/teachers/{id}` | `Partial<TeacherInput>` | `Teacher` |
| DELETE | `/teachers/{id}` | - | 204 |
| GET | `/teachers/{id}/subjects` | - | `{id, teacher_id, subject_id}[]` |
| PUT | `/teachers/{id}/subjects` | `{subject_ids: number[]}` | same as GET (replaces the full set) |

```ts
interface Teacher {
  id: number
  name: string
  email: string | null
  phone: string | null
  max_periods_per_day: number
  is_active: boolean
  subject_ids: number[] // qualified subjects, included directly on the roster response
}
interface TeacherInput {
  name: string
  email: string | null
  phone: string | null
  max_periods_per_day: number
  is_active: boolean
}
```

## Subjects

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/subjects` | - | `Subject[]` |
| POST | `/subjects` | `SubjectInput` | `Subject` (201) |
| PUT | `/subjects/{id}` | `Partial<SubjectInput>` | `Subject` |
| DELETE | `/subjects/{id}` | - | 204 |

```ts
interface Subject { id: number; name: string; code: string; is_lab: boolean }
interface SubjectInput { name: string; code: string; is_lab: boolean }
```

## Classes

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/classes` | - | `SchoolClass[]` |
| POST | `/classes` | `ClassInput` | `SchoolClass` (201) |
| PUT | `/classes/{id}` | `Partial<ClassInput>` | `SchoolClass` |
| DELETE | `/classes/{id}` | - | 204 |

```ts
interface SchoolClass {
  id: number
  grade: number
  section: string
  strength: number
  display_name: string // e.g. "Grade 10 - A", computed server-side
  class_teacher_id: number | null // homeroom teacher; administrative only, not used by the solver
  class_teacher_name: string | null
}
interface ClassInput { grade: number; section: string; strength: number; class_teacher_id: number | null }
```

## Rooms

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/rooms` | - | `Room[]` |
| POST | `/rooms` | `RoomInput` | `Room` (201) |
| PUT | `/rooms/{id}` | `Partial<RoomInput>` | `Room` |
| DELETE | `/rooms/{id}` | - | 204 |

```ts
type RoomType = "classroom" | "lab" | "auditorium" | "sports"
interface Room { id: number; name: string; room_type: RoomType; capacity: number }
interface RoomInput { name: string; room_type: RoomType; capacity: number }
```

## Days / Periods (read-only from the frontend)

| Method | Path | Response |
|---|---|---|
| GET | `/days` | `Day[]` |
| GET | `/periods` | `Period[]` |

```ts
interface Day { id: number; name: string; order_index: number }
interface Period {
  id: number
  period_number: number // 1-8 for teaching periods; the lunch break is its own row with is_break=true
  start_time: string // "HH:MM:SS"
  end_time: string
  is_break: boolean
  label: string | null
}
```

## Requirements (periods/week per class + subject, optionally teacher-pinned)

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/requirements?class_id=` | - | `Requirement[]` |
| POST | `/requirements` | `RequirementInput` | `Requirement` (201) |
| PUT | `/requirements/{id}` | `Partial<RequirementInput>` | `Requirement` |
| DELETE | `/requirements/{id}` | - | 204 |

```ts
interface Requirement {
  id: number
  class_id: number
  subject_id: number
  periods_per_week: number
  teacher_id: number | null // pinned teacher; null = solver picks any qualified teacher
  teacher_name: string | null
}
interface RequirementInput { class_id: number; subject_id: number; periods_per_week: number; teacher_id: number | null }
```
Pinning an unqualified teacher is rejected with 400 and an explanatory message.

## Constraints (LLM layer)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/constraints/parse` | `{text: string, history: ConversationTurn[]}` | `ParseResponse` |
| POST | `/constraints` | `ConfirmConstraintInput` | `Constraint` (201) |
| GET | `/constraints?active_only=false` | - | `Constraint[]` |
| PUT | `/constraints/{id}` | `{severity?, weight?, is_active?}` | `Constraint` |
| DELETE | `/constraints/{id}` | - | 204 |

`/parse` never saves anything - it's a preview. `history` is oldest-first;
sending back every prior turn in the current chat lets the LLM resolve a
short follow-up ("Kiran Rao") against what was already established earlier
("Rao can't teach mornings" + "which Rao?").

```ts
type ConstraintType = "teacher_unavailable" | "teacher_preferred_slot" | "subject_time_preference"
  | "max_periods_per_day" | "no_consecutive" | "room_requirement"
type ConstraintSeverity = "hard" | "soft"

interface ConversationTurn { role: "user" | "assistant"; text: string }

interface ParseResponse {
  status: "resolved" | "clarification_needed" | "unparseable" | "llm_error"
  raw_text: string
  constraint_type: ConstraintType | null
  severity: ConstraintSeverity | null
  weight: number | null
  payload: Record<string, unknown> | null // solver-ready, id-based - shape depends on constraint_type
  llm_explanation: string | null          // the model's own one-line paraphrase
  human_description: string | null        // generated from the resolved payload - what the confirm card shows
  clarification_question: string | null
  candidates: string[]                    // e.g. ambiguous teacher names, or classes needing per-class confirmation
  error_message: string | null
}

interface Constraint {
  id: number
  constraint_type: ConstraintType
  raw_text: string
  payload: Record<string, unknown>
  severity: ConstraintSeverity
  weight: number
  is_active: boolean
  created_at: string
  description: string | null // human-readable, same generator as human_description above
}
interface ConfirmConstraintInput {
  constraint_type: ConstraintType
  raw_text: string
  payload: Record<string, unknown>
  severity: ConstraintSeverity
  weight: number
}
```

## Timetables

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/timetables/generate` | `{name: string}` | `Timetable` (201) - **can take up to `SOLVER_MAX_SECONDS` (30s default) to respond** |
| GET | `/timetables` | - | `Timetable[]` |
| GET | `/timetables/{id}` | - | `Timetable` |
| GET | `/timetables/{id}/entries?class_id=&teacher_id=` | - | `TimetableEntry[]` |
| GET | `/timetables/{id}/explain` | - | `{timetable_id: number, explanation: string}` |
| PUT | `/timetables/{id}/entries/{entryId}/move` | `{day_id: number, period_id: number}` | `TimetableEntry` or 409 with a reason |
| DELETE | `/timetables/{id}` | - | 204 |
| GET | `/timetables/{id}/export/excel` | - | binary `.xlsx` file download |
| GET | `/timetables/{id}/export/pdf` | - | binary `.pdf` file download |

`generate` always returns 201 even on failure - check `status`: `"failed"`
means no feasible timetable was found, with a plain-English explanation in
`message` (already jargon-free, written for a non-technical admin). `move`
re-validates hard constraints server-side (teacher/class/room clashes) and
auto-reassigns the room if the original is taken; it only 409s if truly
nothing is free.

```ts
type TimetableStatus = "draft" | "generating" | "completed" | "failed"

interface Timetable {
  id: number
  name: string
  status: TimetableStatus
  score: number | null   // lower is better; null until solved
  message: string | null // plain-English summary or failure explanation
  created_at: string
}

interface TimetableEntry {
  id: number
  class_id: number; class_name: string
  day_id: number; day_name: string
  period_id: number; period_number: number; start_time: string; end_time: string
  subject_id: number; subject_name: string; subject_is_lab: boolean
  teacher_id: number; teacher_name: string
  room_id: number; room_name: string
}
```

## Not yet exposed by the backend (frontend currently mocks or defers these)

- **Cancel a running generation** - `generate` is synchronous today; the
  Generate screen's "cancel" button (Phase 4) will need either a real
  cancel endpoint or a switch to an async job + polling pattern.
- **Publish / version comparison** - the backend has no "published" flag;
  the dashboard's "latest timetable" card currently just shows the most
  recently created one. A `PUT /timetables/{id}/publish` (or similar) is
  needed for the viewer's version-compare + publish action in Phase 5.
- **"Print all" PDF** - only per-timetable PDF export (one page per class)
  exists today.
