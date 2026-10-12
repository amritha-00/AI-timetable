/**
 * In-memory demo dataset for "Load demo school" and local development
 * without a backend. Deliberately mirrors database/seed.sql (same school,
 * same names) so behavior seen against mocks matches the real API once
 * VITE_USE_MOCKS is turned off - nobody reviewing the portfolio piece can
 * tell the difference from the UI alone.
 *
 * These arrays are mutated in place by src/lib/api/mocks/store.ts to
 * simulate a real backend's create/update/delete - so this module is the
 * *initial* state, reset() restores it.
 */
import type {
  Constraint,
  Day,
  Period,
  Requirement,
  Room,
  SchoolClass,
  Subject,
  Teacher,
  Timetable,
  TimetableEntry,
} from "@/types"

const TEACHER_NAMES: Array<[string, string]> = [
  ["Anita Sharma", "anita.sharma@school.edu"],
  ["Ramesh Gupta", "ramesh.gupta@school.edu"],
  ["Priya Nair", "priya.nair@school.edu"],
  ["Suresh Iyer", "suresh.iyer@school.edu"],
  ["Kavita Rao", "kavita.rao@school.edu"],
  ["Manoj Verma", "manoj.verma@school.edu"],
  ["Deepa Menon", "deepa.menon@school.edu"],
  ["Arjun Reddy", "arjun.reddy@school.edu"],
  ["Sneha Kulkarni", "sneha.kulkarni@school.edu"],
  ["Vikram Singh", "vikram.singh@school.edu"],
  ["Pooja Joshi", "pooja.joshi@school.edu"],
  ["Rajesh Pillai", "rajesh.pillai@school.edu"],
  ["Neha Desai", "neha.desai@school.edu"],
  ["Amit Kapoor", "amit.kapoor@school.edu"],
  ["Divya Krishnan", "divya.krishnan@school.edu"],
  ["Sanjay Mehta", "sanjay.mehta@school.edu"],
  ["Lakshmi Pillai", "lakshmi.pillai@school.edu"],
  ["Rohit Bhatt", "rohit.bhatt@school.edu"],
  ["Meera Iyengar", "meera.iyengar@school.edu"],
  ["Kiran Rao", "kiran.rao@school.edu"],
]

const SUBJECTS_SEED: Array<[string, string, boolean]> = [
  ["English", "ENG", false],
  ["Hindi", "HIN", false],
  ["Mathematics", "MATH", false],
  ["Science", "SCI", true],
  ["Social Studies", "SST", false],
  ["Computer Science", "CS", true],
  ["Physical Education", "PE", false],
  ["Art & Craft", "ART", false],
  ["Sanskrit", "SANS", false],
  ["General Knowledge", "GK", false],
]

// teacher index (0-based, matches TEACHER_NAMES) -> subject codes qualified for
const QUALIFICATIONS: Record<number, string[]> = {
  0: ["MATH"], 1: ["MATH"], 2: ["MATH"],
  3: ["SCI"], 4: ["SCI"], 5: ["SCI"],
  6: ["ENG"], 7: ["ENG"], 8: ["ENG"],
  9: ["HIN"], 10: ["HIN"],
  11: ["SST"], 12: ["SST"],
  13: ["CS"], 14: ["CS"],
  15: ["PE"], 16: ["PE"],
  17: ["ART", "GK"], 18: ["ART", "SANS"], 19: ["SANS", "GK"],
}

const PERIODS_PER_WEEK: Record<string, number> = {
  MATH: 6, SCI: 6, ENG: 5, HIN: 4, SST: 4, CS: 3, PE: 3, ART: 2, SANS: 3, GK: 2,
}

const CLASS_TEACHER_INDEX: Record<string, number> = {
  "6-A": 0, "6-B": 6, "7-A": 3, "7-B": 9, "8-A": 11,
  "8-B": 4, "9-A": 15, "9-B": 18, "10-A": 2, "10-B": 7,
}

export function buildInitialData() {
  const days: Day[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((name, i) => ({
    id: i + 1,
    name,
    order_index: i + 1,
  }))

  const periods: Period[] = [
    { id: 1, period_number: 1, start_time: "08:00:00", end_time: "08:40:00", is_break: false, label: "Period 1" },
    { id: 2, period_number: 2, start_time: "08:40:00", end_time: "09:20:00", is_break: false, label: "Period 2" },
    { id: 3, period_number: 3, start_time: "09:20:00", end_time: "10:00:00", is_break: false, label: "Period 3" },
    { id: 4, period_number: 4, start_time: "10:00:00", end_time: "10:40:00", is_break: false, label: "Period 4" },
    { id: 5, period_number: 9, start_time: "10:40:00", end_time: "11:10:00", is_break: true, label: "Lunch Break" },
    { id: 6, period_number: 5, start_time: "11:10:00", end_time: "11:50:00", is_break: false, label: "Period 5" },
    { id: 7, period_number: 6, start_time: "11:50:00", end_time: "12:30:00", is_break: false, label: "Period 6" },
    { id: 8, period_number: 7, start_time: "12:30:00", end_time: "13:10:00", is_break: false, label: "Period 7" },
    { id: 9, period_number: 8, start_time: "13:10:00", end_time: "13:50:00", is_break: false, label: "Period 8" },
  ]

  const subjects: Subject[] = SUBJECTS_SEED.map(([name, code, is_lab], i) => ({ id: i + 1, name, code, is_lab }))
  const subjectByCode = Object.fromEntries(subjects.map((s) => [s.code, s]))

  const gradeSections: Array<[number, string, number]> = [
    [6, "A", 42], [6, "B", 40], [7, "A", 44], [7, "B", 41], [8, "A", 39],
    [8, "B", 43], [9, "A", 40], [9, "B", 38], [10, "A", 36], [10, "B", 37],
  ]
  const classes: SchoolClass[] = gradeSections.map(([grade, section, strength], i) => {
    const teacherIdx = CLASS_TEACHER_INDEX[`${grade}-${section}`]
    return {
      id: i + 1,
      grade,
      section,
      strength,
      display_name: `Grade ${grade} - ${section}`,
      class_teacher_id: teacherIdx + 1,
      class_teacher_name: TEACHER_NAMES[teacherIdx][0],
    }
  })

  const rooms: Room[] = [
    ...Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      name: `Room-${101 + i}`,
      room_type: "classroom" as const,
      capacity: 45,
    })),
    { id: 11, name: "Computer Lab 1", room_type: "lab", capacity: 35 },
    { id: 12, name: "Computer Lab 2", room_type: "lab", capacity: 35 },
    { id: 13, name: "Science Lab 1", room_type: "lab", capacity: 30 },
    { id: 14, name: "Science Lab 2", room_type: "lab", capacity: 30 },
  ]

  const teachers: Teacher[] = TEACHER_NAMES.map(([name, email], i) => ({
    id: i + 1,
    name,
    email,
    phone: `98000000${String(i + 1).padStart(2, "0")}`,
    max_periods_per_day: 6,
    is_active: true,
    subject_ids: (QUALIFICATIONS[i] ?? []).map((code) => subjectByCode[code].id),
  }))

  let reqId = 1
  const requirements: Requirement[] = []
  for (const cls of classes) {
    for (const [code, ppw] of Object.entries(PERIODS_PER_WEEK)) {
      requirements.push({
        id: reqId++,
        class_id: cls.id,
        subject_id: subjectByCode[code].id,
        periods_per_week: ppw,
        teacher_id: null,
        teacher_name: null,
      })
    }
  }

  const constraints: Constraint[] = []
  const timetables: Timetable[] = []
  const timetableEntries: TimetableEntry[] = []

  return { days, periods, subjects, classes, rooms, teachers, requirements, constraints, timetables, timetableEntries }
}
