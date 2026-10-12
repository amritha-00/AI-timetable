import type {
  Constraint,
  ConstraintSeverity,
  ConstraintType,
  Day,
  Period,
  Requirement,
  Room,
  RoomType,
  SchoolClass,
  Subject,
  Teacher,
} from "@/types"
import { buildInitialData } from "./data"

/** Simulated network latency so loading states are actually visible/testable
 * against mocks, instead of resolving instantly. */
const LATENCY_MS = 250

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS))
}

class MockApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

let state = buildInitialData()
let nextIds = { teacher: 21, subject: 11, class: 11, room: 15, requirement: 101, constraint: 1, timetable: 1 }

export function resetMockData() {
  state = buildInitialData()
  nextIds = { teacher: 21, subject: 11, class: 11, room: 15, requirement: 101, constraint: 1, timetable: 1 }
}

// ---------- Teachers ----------
export const mockTeachers = {
  list: () => delay([...state.teachers]),
  create: (input: Omit<Teacher, "id" | "subject_ids">) => {
    const teacher: Teacher = { ...input, id: nextIds.teacher++, subject_ids: [] }
    state.teachers.push(teacher)
    return delay(teacher)
  },
  update: (id: number, input: Partial<Teacher>) => {
    const t = state.teachers.find((x) => x.id === id)
    if (!t) return Promise.reject(new MockApiError(404, "Teacher not found"))
    Object.assign(t, input)
    return delay(t)
  },
  remove: (id: number) => {
    state.teachers = state.teachers.filter((x) => x.id !== id)
    state.classes.forEach((c) => {
      if (c.class_teacher_id === id) {
        c.class_teacher_id = null
        c.class_teacher_name = null
      }
    })
    return delay(undefined)
  },
  setSubjects: (id: number, subjectIds: number[]) => {
    const t = state.teachers.find((x) => x.id === id)
    if (!t) return Promise.reject(new MockApiError(404, "Teacher not found"))
    t.subject_ids = subjectIds
    return delay(t)
  },
}

// ---------- Subjects ----------
export const mockSubjects = {
  list: () => delay([...state.subjects]),
  create: (input: Omit<Subject, "id">) => {
    const s: Subject = { ...input, id: nextIds.subject++ }
    state.subjects.push(s)
    return delay(s)
  },
  update: (id: number, input: Partial<Subject>) => {
    const s = state.subjects.find((x) => x.id === id)
    if (!s) return Promise.reject(new MockApiError(404, "Subject not found"))
    Object.assign(s, input)
    return delay(s)
  },
  remove: (id: number) => {
    state.subjects = state.subjects.filter((x) => x.id !== id)
    return delay(undefined)
  },
}

// ---------- Classes ----------
export const mockClasses = {
  list: () => delay([...state.classes]),
  create: (input: { grade: number; section: string; strength: number; class_teacher_id: number | null }) => {
    const teacher = state.teachers.find((t) => t.id === input.class_teacher_id)
    const c: SchoolClass = {
      id: nextIds.class++,
      grade: input.grade,
      section: input.section,
      strength: input.strength,
      display_name: `Grade ${input.grade} - ${input.section}`,
      class_teacher_id: input.class_teacher_id,
      class_teacher_name: teacher?.name ?? null,
    }
    state.classes.push(c)
    return delay(c)
  },
  update: (id: number, input: Partial<SchoolClass>) => {
    const c = state.classes.find((x) => x.id === id)
    if (!c) return Promise.reject(new MockApiError(404, "Class not found"))
    Object.assign(c, input)
    if (input.grade !== undefined || input.section !== undefined) {
      c.display_name = `Grade ${c.grade} - ${c.section}`
    }
    if (input.class_teacher_id !== undefined) {
      const teacher = state.teachers.find((t) => t.id === input.class_teacher_id)
      c.class_teacher_name = teacher?.name ?? null
    }
    return delay(c)
  },
  remove: (id: number) => {
    state.classes = state.classes.filter((x) => x.id !== id)
    return delay(undefined)
  },
}

// ---------- Rooms ----------
export const mockRooms = {
  list: () => delay([...state.rooms]),
  create: (input: { name: string; room_type: RoomType; capacity: number }) => {
    const r: Room = { ...input, id: nextIds.room++ }
    state.rooms.push(r)
    return delay(r)
  },
  update: (id: number, input: Partial<Room>) => {
    const r = state.rooms.find((x) => x.id === id)
    if (!r) return Promise.reject(new MockApiError(404, "Room not found"))
    Object.assign(r, input)
    return delay(r)
  },
  remove: (id: number) => {
    state.rooms = state.rooms.filter((x) => x.id !== id)
    return delay(undefined)
  },
}

// ---------- Days / Periods (read-only in the UI for now) ----------
export const mockDays = { list: () => delay([...state.days] as Day[]) }
export const mockPeriods = { list: () => delay([...state.periods] as Period[]) }

// ---------- Requirements ----------
export const mockRequirements = {
  list: (classId?: number) =>
    delay(classId ? state.requirements.filter((r) => r.class_id === classId) : [...state.requirements]),
  create: (input: { class_id: number; subject_id: number; periods_per_week: number; teacher_id: number | null }) => {
    const teacher = input.teacher_id ? state.teachers.find((t) => t.id === input.teacher_id) : undefined
    const r: Requirement = { ...input, id: nextIds.requirement++, teacher_name: teacher?.name ?? null }
    state.requirements.push(r)
    return delay(r)
  },
  update: (id: number, input: Partial<Requirement>) => {
    const r = state.requirements.find((x) => x.id === id)
    if (!r) return Promise.reject(new MockApiError(404, "Requirement not found"))
    Object.assign(r, input)
    if (input.teacher_id !== undefined) {
      const teacher = state.teachers.find((t) => t.id === input.teacher_id)
      r.teacher_name = teacher?.name ?? null
    }
    return delay(r)
  },
  remove: (id: number) => {
    state.requirements = state.requirements.filter((x) => x.id !== id)
    return delay(undefined)
  },
}

// ---------- Constraints ----------
export const mockConstraints = {
  list: () => delay([...state.constraints]),
  save: (input: {
    constraint_type: ConstraintType
    raw_text: string
    payload: Record<string, unknown>
    severity: ConstraintSeverity
    weight: number
  }) => {
    const c: Constraint = {
      ...input,
      id: nextIds.constraint++,
      is_active: true,
      created_at: new Date().toISOString(),
      description: input.raw_text,
    }
    state.constraints.push(c)
    return delay(c)
  },
  update: (id: number, input: Partial<Constraint>) => {
    const c = state.constraints.find((x) => x.id === id)
    if (!c) return Promise.reject(new MockApiError(404, "Constraint not found"))
    Object.assign(c, input)
    return delay(c)
  },
  remove: (id: number) => {
    state.constraints = state.constraints.filter((x) => x.id !== id)
    return delay(undefined)
  },
}

// ---------- Timetables ----------
export const mockTimetables = {
  list: () => delay([...state.timetables]),
  get: (id: number) => {
    const t = state.timetables.find((x) => x.id === id)
    if (!t) return Promise.reject(new MockApiError(404, "Timetable not found"))
    return delay(t)
  },
  entries: (timetableId: number, filters: { class_id?: number; teacher_id?: number }) => {
    let rows = state.timetableEntries.filter((e) => e.id > 0 && timetableId === timetableId)
    if (filters.class_id) rows = rows.filter((e) => e.class_id === filters.class_id)
    if (filters.teacher_id) rows = rows.filter((e) => e.teacher_id === filters.teacher_id)
    return delay(rows)
  },
  remove: (id: number) => {
    state.timetables = state.timetables.filter((x) => x.id !== id)
    return delay(undefined)
  },
}

export { MockApiError }
