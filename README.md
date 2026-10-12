# AI-Powered School Timetable Generator

A web app where a school admin enters teachers, subjects, classes, rooms, and
periods, then generates a clash-free weekly timetable. The core scheduler uses
Google OR-Tools (CP-SAT). An LLM layer lets the admin type constraints in
plain English and converts them into structured, validated constraint objects
— the LLM never builds the timetable itself.

**Status: Phases 1-4 complete** (data layer, CP-SAT solver, LLM constraint
layer, React frontend). See `## Phases` below. Phase 5 (evaluation, tests,
Docker) is next.

## Tech stack

- **Database:** MySQL (via XAMPP), SQLAlchemy 2.x ORM, PyMySQL driver
- **Backend:** Python 3.11+, FastAPI, Pydantic v2
- **Solver:** Google OR-Tools CP-SAT
- **LLM:** Anthropic Claude, AWS Bedrock (Amazon Nova), or Google Gemini
  (free tier), configurable via `.env` (plus a deterministic offline "mock"
  provider for dev/testing)
- **Frontend:** React + Vite + Tailwind CSS v4

## Project structure

```
time-table/
├── .env.example              # copy to .env, fill in credentials
├── database/
│   ├── schema.sql             # CREATE TABLE statements only
│   ├── seed.sql                # sample data only (run after schema.sql)
│   └── timetable_ai.sql       # schema.sql + seed.sql combined, for phpMyAdmin import
├── backend/
│   ├── requirements.txt
│   ├── app/
│   │   ├── config.py          # Settings, loaded from .env
│   │   ├── main.py             # FastAPI app + router registration
│   │   ├── db/session.py      # SQLAlchemy engine/session
│   │   ├── models/            # ORM models (one file per entity)
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── routers/           # CRUD + generate/parse/export/move endpoints
│   │   ├── solver/             # OR-Tools CP-SAT solver + conflict explainer
│   │   └── llm/                 # LLM provider adapters + constraint parser
│   ├── scripts/
│   │   ├── create_tables.py   # ORM-based table creation (dev convenience)
│   │   └── seed_data.py        # ORM-based seeding, mirrors database/seed.sql
│   └── tests/                  # pytest suite (Phase 5)
└── frontend/                   # React + Vite + Tailwind app
    ├── src/api/client.js      # single point of contact with the backend
    ├── src/components/         # Layout, DataTable, TimetableGrid, ui.jsx
    ├── src/pages/               # Data / Constraints / Generate / Viewer
    └── test_e2e.mjs             # Playwright smoke test (see below)
```

## Full setup (XAMPP + backend + frontend)

### 1. Start MySQL in XAMPP

Open the XAMPP Control Panel and start **MySQL** (Apache is not required for
this project — the backend runs its own server via `uvicorn`).

### 2. Create the database and import schema + sample data

**Option A — phpMyAdmin (recommended for you):**
1. Open phpMyAdmin (`http://localhost/phpmyadmin`).
2. Create a database named `timetable_ai` (or let the import do it — the SQL
   file includes `CREATE DATABASE IF NOT EXISTS`).
3. Go to the **Import** tab, choose `database/timetable_ai.sql`, and run it.
   This creates all 11 tables and inserts the sample data (20 teachers, 10
   subjects, 10 classes, 14 rooms, 6 days, 9 periods incl. lunch break, 23
   teacher-subject qualifications, 100 class-subject requirements).

**Option B — command line** (if `mysql.exe` is on your PATH, e.g.
`C:\xampp\mysql\bin`):
```bash
mysql -u root < database/schema.sql
mysql -u root < database/seed.sql
```

**Option C — Python/ORM** (no SQL client needed, from `backend/` with the
venv active — see step 3 first):
```bash
python scripts/create_tables.py
python scripts/seed_data.py
```
All three options produce identical data — pick whichever is convenient.
Options B/C are also how you reset/reseed later (both are safe to re-run).

### 3. Set up the backend

```bash
cd backend
python -m venv .venv

# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

From the project root, copy the environment template if you haven't already:
```bash
cp .env.example .env
```
The defaults already match XAMPP (`localhost:3306`, user `root`, empty
password, database `timetable_ai`) — no edits needed for local dev.

To use the LLM constraint layer, set one of:
- `LLM_PROVIDER=gemini` and `GEMINI_API_KEY=...` — **free, no credit card**:
  get a key at https://aistudio.google.com/apikey. This is the `.env.example`
  default, since it's the easiest way to actually run the LLM layer for
  free.
- `LLM_PROVIDER=anthropic` and `ANTHROPIC_API_KEY=...` (get a key from
  https://console.anthropic.com/ — new accounts get a small free credit), or
- `LLM_PROVIDER=bedrock` and AWS credentials with Bedrock access to Amazon
  Nova, or
- `LLM_PROVIDER=mock` to try the whole app (including constraint parsing)
  with **no API key at all**, via a deterministic offline stand-in (see
  `backend/app/llm/mock_provider.py`). Useful for a zero-setup demo; not
  representative of real parsing accuracy - see Phase 5 for that.

All four providers implement the same `LLMProvider` interface
(`backend/app/llm/base.py`), so switching between them is a one-line `.env`
change - no other code changes anywhere in the app.

### 4. Run the API

```bash
# from backend/, venv active
uvicorn app.main:app --reload --port 8000
```

Open **http://localhost:8000/docs** for interactive Swagger docs covering
every endpoint: CRUD for teachers/subjects/classes/rooms/days/periods/
requirements, constraint parsing (`/api/constraints/parse`) and saving,
timetable generation (`/api/timetables/generate`), viewing, manual
drag-and-drop moves, PDF/Excel export, and plain-English explanations.

### 5. Set up the frontend

```bash
cd frontend
npm install
npm run dev
```
Open **http://localhost:5173**. The Vite dev server proxies `/api/*` to
`http://localhost:8000` (see `frontend/vite.config.js`), so just run the
backend from step 4 alongside it - no CORS configuration needed in dev.

### 6. Quick smoke test

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/teachers
curl http://localhost:8000/api/classes
```
You should see `{"status":"ok",...}` and the seeded rows. Then open the
frontend, go to **Generate**, click **Generate Timetable** (takes up to
30s), and open **Timetable** to see the result.

## What's implemented

### Phase 1 - Data layer

- **11 normalized MySQL tables** with foreign keys: `teachers`, `subjects`,
  `classes`, `rooms`, `days`, `periods`, `teacher_subjects`,
  `class_subject_requirements`, `constraints`, `timetables`,
  `timetable_entries`.
- **SQLAlchemy 2.x models** (typed, with relationships) mirroring the schema
  exactly, in `backend/app/models/`.
- **Sample data** for a realistic Indian school: 6 days (Mon–Sat), 8 teaching
  periods/day + 1 lunch break, 10 classes (grades 6–10, sections A/B), 20
  teachers, 10 subjects (2 lab subjects: Science, Computer Science), 14 rooms
  (10 classrooms + 4 labs).
- **Basic CRUD REST API** (FastAPI + Pydantic v2) for every entity above
  except `constraints`/`timetables` (those arrive in Phases 2–3), plus an
  endpoint to manage which subjects a teacher is qualified to teach.
- **`.env`-based config** with `.env.example` committed and no hardcoded
  secrets; `app/config.py` centralizes all settings.
- **Class teacher (homeroom teacher) assignment**: each class has an optional
  `class_teacher_id`, editable from the Classes tab. This is administrative
  metadata only (attendance, discipline, parent contact) - it does not imply
  anything about the solver's schedule; use a `subject_time_preference`
  constraint if a class teacher should specifically teach period 1, etc.
- **Teacher &rarr; Subject assignment matrix** (Data Management's
  "Assignments" tab): every teacher's subject qualifications in one
  click-to-toggle grid, backed by the same `teacher_subjects` table the
  per-teacher "Subjects" modal edits - both stay in sync.
- **Pinned teacher per class+subject** (Requirements tab): by default the
  solver picks any qualified teacher freely for each class's subject
  periods, which can split one class's Math periods across several
  different teachers over the week. Setting a requirement's `teacher_id`
  (only offering teachers actually qualified for that subject) pins one
  specific teacher to every period of that class+subject - the solver then
  treats it as a hard constraint. The pre-generation capacity check
  (`conflict_explainer.pre_check`) accounts for pinned commitments too, so
  over-pinning a teacher beyond their `max_periods_per_day` is caught with a
  specific message before the solver even runs.
- **Left sidebar navigation** for Data Management, replacing the earlier top
  tab bar.
- **Teacher Allocation panel** ("Allocation" tab): pick a teacher, see and
  manage everything they're assigned to in one place - which class(es) they're
  the homeroom/class teacher of, and every class+subject they're pinned to
  teach (e.g. Science for one class and a different subject for another,
  entirely independent pins). Assigning a class+subject that's already
  pinned to someone else asks for confirmation first, naming who currently
  holds it, before reassigning.
- **"Class teacher" constraints**: the LLM's system prompt now includes each
  class's assigned class teacher (from `class_teacher_id`), so "the class
  teacher of Grade 6 - A should teach period 1" resolves to that teacher's
  real name and becomes an ordinary constraint - instead of a blanket "not
  supported" refusal. A bulk phrase like "all class teachers should teach
  period 1" can't become one structured constraint (each one targets a
  single teacher), so it returns a clarification listing every class that
  currently has a class teacher assigned, asking the admin to either specify
  one class or confirm applying it to all of them one sentence at a time.
  The resolver (`app/llm/resolver.py`) also has a regex fallback that
  resolves "class teacher of X" / "X's class teacher" / "X class teacher"
  directly, in case the LLM passes the phrase through instead of resolving
  it itself.
- **Conversational constraint chat**: the Constraints page is now a real chat
  thread (message bubbles, not a single input+result), and the backend
  accepts the prior turns (`ParseRequest.history`) on every `/parse` call so
  a short follow-up like "Kiran Rao" correctly answers an earlier "which Rao
  did you mean?" and is combined with what was already said (e.g. "can't
  teach mornings" from turn one) into one complete constraint - not treated
  as a brand new, context-free request. The backend stays stateless: the
  frontend owns the thread and replays it each call, folded into a single
  "conversation so far" block in the prompt rather than threading a native
  multi-turn messages array through all three provider implementations.

### Phase 2 - CP-SAT solver (`backend/app/solver/`)

- Factored CP-SAT model (`subject_assigned` + `teacher_assigned` variables,
  rooms treated as a capacity-pooled resource rather than individually
  identified) - keeps the model an order of magnitude smaller than a naive
  joint formulation. See the module docstring in `model_builder.py` for the
  full reasoning.
- All 8 hard constraints from the spec (teacher/room/class clash-freedom,
  exact weekly periods, qualified-teacher-only, lab-room-only, no classes in
  breaks, teacher unavailability) and all 4 soft constraints (same-subject
  cap, workload balance, max-3-consecutive, preferred slots), each a
  weighted term in the objective.
- **Conflict explanation, not just "infeasible":** fast arithmetic
  pre-checks (`conflict_explainer.pre_check`) catch the common causes
  (not enough qualified teachers, not enough room capacity, over-committed
  classes) before the solver even runs; if CP-SAT itself reports
  infeasible, each active hard constraint is disabled one at a time and
  re-solved to identify the likely culprit(s).
- Verified against the seeded data: generates all 380 required class-periods
  with zero teacher/room/class clashes (checked directly in MySQL, not just
  trusted from the solver's own report).

### Phase 3 - LLM constraint layer (`backend/app/llm/`)

- One common `LLMProvider` interface (`base.py`) with `AnthropicProvider`,
  `BedrockProvider`, and `GeminiProvider` implementations, switchable via
  `LLM_PROVIDER` in `.env` with no other code changes - plus a fourth
  `MockProvider` for offline dev/testing (see above). Gemini is the
  free-tier-friendly default: it skips Gemini's strict `response_schema`
  mode (which only supports a JSON-Schema subset our discriminated-union
  constraint schema doesn't fit) in favor of JSON mode plus the same
  Pydantic validation every provider's output goes through either way - see
  the docstring in `gemini_provider.py`.
- Six constraint types as **strict, discriminated-union Pydantic schemas**
  (`app/schemas/constraint_types.py`): `teacher_unavailable`,
  `teacher_preferred_slot`, `subject_time_preference`,
  `max_periods_per_day`, `no_consecutive`, `room_requirement`.
- The system prompt (`prompts.py`) lists every current teacher, subject,
  class, day, and period from the database, so the LLM can only reference
  entities that actually exist - it calls a `submit_constraint` tool with a
  JSON-schema-validated shape rather than free-form text.
- **Resolution against the live database** (`resolver.py`): every
  name the LLM produces (e.g. "Rao") is matched against the real roster.
  Two teachers named Rao, or no match at all, returns a specific
  clarification question instead of guessing - verified with the two Rao
  teachers seeded in the sample data.
- Vague-phrase mapping ("morning" → periods 1-4, "afternoon" → periods 5-8,
  "end of the week" → Friday+Saturday) is given to the LLM as an instruction
  *and* deterministically re-applied as a fallback in the resolver, so it's
  never wrong even if the model's own arithmetic slips.
- `POST /api/constraints/parse` returns a preview (never saves); the
  frontend's confirm/edit/reject card calls `POST /api/constraints` only
  once the admin approves it (optionally after editing severity/weight).
- `GET /api/timetables/{id}/explain` asks the LLM to rewrite the solver's
  technical result in plain English; falls back to the technical message if
  the LLM call fails, so a missing API key never breaks the page.

### Phase 4 - Frontend (`frontend/`)

- **Data Management**: tabbed CRUD (Teachers, Subjects, Classes, Rooms,
  Requirements) via one generic, reusable `DataTable` component, plus a
  dedicated modal for managing which subjects each teacher can teach.
- **Constraints**: the chat-style input + confirm/edit/reject card described
  above, with a running list of saved constraints (toggle active/inactive,
  delete).
- **Generate**: one-click generation with a loading state (the request can
  take up to `SOLVER_MAX_SECONDS`), the result summary, a run history, and
  an "Explain in plain English" action per run.
- **Timetable Viewer**: class view and teacher view (same grid component,
  different filter), subjects color-coded consistently by id, and
  **drag-and-drop manual editing** - dragging an entry to a new day/period
  calls `PUT /api/timetables/{id}/entries/{entry_id}/move`, which
  re-validates the class/teacher/room hard constraints server-side and
  either applies the move (auto-reassigning the room if the original one is
  now taken) or rejects it with a specific reason.
- **Export**: Excel (one sheet per class) and PDF (one page per class),
  generated server-side with openpyxl/reportlab so the same data the viewer
  shows is exactly what downloads.
- Verified with a real, running Chromium instance (Playwright), not just a
  production build: every page loads without console errors, the full
  parse→confirm→save→generate→view→drag-to-reschedule flow works against
  the live backend, and the drag-and-drop was confirmed to trigger the
  server-side room-reassignment fallback (see `frontend/test_e2e.mjs`).

## Design note: why period 9 is the lunch break

Periods are numbered 1–8 for actual teaching slots (so "periods 1–4" =
morning and "periods 5–8" = afternoon map directly to the LLM's vague-phrase
handling in Phase 3). The lunch break is stored as `period_number = 9` with
`is_break = true`; it sits chronologically between period 4 and period 5 by
`start_time`, and the solver/UI order periods by `start_time`, not by
`period_number`, so it displays in the right place.

## Running the frontend E2E smoke test

`frontend/test_e2e.mjs` drives a real Chromium instance through the whole
app (data CRUD → parse a constraint → save it → generate a timetable → view
it → switch views) and fails loudly on any console/page error. It needs
Playwright, which isn't a normal dependency (only used for this check):
```bash
cd frontend
npm install -D playwright && npx playwright install chromium
node test_e2e.mjs   # backend must be running on :8000, frontend on :5173
```

## Phases

1. ✅ Project structure, `.env` setup, MySQL schema, SQLAlchemy models, seed
   data, `.sql` export, basic CRUD APIs
2. ✅ OR-Tools solver with hard/soft constraints, conflict explanation
3. ✅ LLM constraint parser with validation and clarification flow
4. ✅ React frontend
5. Evaluation, tests, README polish, Docker setup
