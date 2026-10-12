/**
 * Shared types across the app. These mirror the real FastAPI backend's
 * Pydantic schemas field-for-field (see backend/app/schemas/*.py) so the
 * mock data layer and the real API client are interchangeable without any
 * mapping/adapter code - swapping USE_MOCKS off just points the same types
 * at real HTTP responses.
 */

// ---------- Roster entities ----------

export interface Teacher {
  id: number
  name: string
  email: string | null
  phone: string | null
  max_periods_per_day: number
  is_active: boolean
  subject_ids: number[]
}

export interface Subject {
  id: number
  name: string
  code: string
  is_lab: boolean
}

export interface SchoolClass {
  id: number
  grade: number
  section: string
  strength: number
  display_name: string
  class_teacher_id: number | null
  class_teacher_name: string | null
}

export type RoomType = "classroom" | "lab" | "auditorium" | "sports"

export interface Room {
  id: number
  name: string
  room_type: RoomType
  capacity: number
}

export interface Day {
  id: number
  name: string
  order_index: number
}

export interface Period {
  id: number
  period_number: number
  start_time: string // "HH:MM:SS"
  end_time: string
  is_break: boolean
  label: string | null
}

export interface Requirement {
  id: number
  class_id: number
  subject_id: number
  periods_per_week: number
  teacher_id: number | null
  teacher_name: string | null
}

// ---------- Constraints (LLM layer) ----------

export type ConstraintType =
  | "teacher_unavailable"
  | "teacher_preferred_slot"
  | "subject_time_preference"
  | "max_periods_per_day"
  | "no_consecutive"
  | "room_requirement"
  | "class_teacher_period"
  | "class_subject_assignment"

export type ConstraintSeverity = "hard" | "soft"

export interface Constraint {
  id: number
  constraint_type: ConstraintType
  raw_text: string
  payload: Record<string, unknown>
  severity: ConstraintSeverity
  weight: number
  is_active: boolean
  created_at: string
  description: string | null
}

export interface ConversationTurn {
  role: "user" | "assistant"
  text: string
}

export type ParseStatus = "resolved" | "clarification_needed" | "unparseable" | "llm_error"

export interface ParseResponse {
  status: ParseStatus
  raw_text: string
  constraint_type: ConstraintType | null
  severity: ConstraintSeverity | null
  weight: number | null
  payload: Record<string, unknown> | null
  llm_explanation: string | null
  human_description: string | null
  clarification_question: string | null
  candidates: string[]
  error_message: string | null
}

export interface ConfirmConstraintInput {
  constraint_type: ConstraintType
  raw_text: string
  payload: Record<string, unknown>
  severity: ConstraintSeverity
  weight: number
}

// ---------- Timetables ----------

export type TimetableStatus = "draft" | "generating" | "completed" | "failed"

export interface Timetable {
  id: number
  name: string
  status: TimetableStatus
  score: number | null
  message: string | null
  created_at: string
}

export interface TimetableEntry {
  id: number
  class_id: number
  class_name: string
  day_id: number
  day_name: string
  period_id: number
  period_number: number
  start_time: string
  end_time: string
  subject_id: number
  subject_name: string
  subject_is_lab: boolean
  teacher_id: number
  teacher_name: string
  room_id: number
  room_name: string
}

export interface GenerateOptions {
  name: string
  time_limit_seconds?: number
  include_soft?: boolean
}

// ---------- Setup completion (derived client-side for the dashboard) ----------

export interface SetupStep {
  key: "teachers" | "subjects" | "classes" | "rooms" | "days" | "requirements"
  label: string
  done: boolean
  count: number
  href: string
}

// ---------- Auth / tenant (one login per school) ----------

export interface Tenant {
  id: number
  school_name: string
  email: string
  is_subscribed: boolean
  trial_generations_used: number
  trial_generations_remaining: number
  created_at: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  tenant: Tenant
}
