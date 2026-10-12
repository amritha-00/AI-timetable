import axios from 'axios'

// Vite's dev server proxies /api/* to the FastAPI backend (see vite.config.js),
// and in production the frontend is expected to be served behind the same
// origin/reverse proxy as the API - so a relative base URL works in both cases.
const client = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const detail = error.response?.data?.detail
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg).join('; ')
      : detail || error.message || 'Something went wrong'
    return Promise.reject(new Error(message))
  },
)

// ---- Generic CRUD entity endpoints ----
export const teachersApi = {
  list: (activeOnly = false) => client.get('/teachers', { params: { active_only: activeOnly } }).then((r) => r.data),
  create: (data) => client.post('/teachers', data).then((r) => r.data),
  update: (id, data) => client.put(`/teachers/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/teachers/${id}`),
  getSubjects: (id) => client.get(`/teachers/${id}/subjects`).then((r) => r.data),
  setSubjects: (id, subjectIds) =>
    client.put(`/teachers/${id}/subjects`, { subject_ids: subjectIds }).then((r) => r.data),
}

export const subjectsApi = {
  list: () => client.get('/subjects').then((r) => r.data),
  create: (data) => client.post('/subjects', data).then((r) => r.data),
  update: (id, data) => client.put(`/subjects/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/subjects/${id}`),
}

export const classesApi = {
  list: () => client.get('/classes').then((r) => r.data),
  create: (data) => client.post('/classes', data).then((r) => r.data),
  update: (id, data) => client.put(`/classes/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/classes/${id}`),
}

export const roomsApi = {
  list: () => client.get('/rooms').then((r) => r.data),
  create: (data) => client.post('/rooms', data).then((r) => r.data),
  update: (id, data) => client.put(`/rooms/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/rooms/${id}`),
}

export const daysApi = {
  list: () => client.get('/days').then((r) => r.data),
}

export const periodsApi = {
  list: () => client.get('/periods').then((r) => r.data),
}

export const requirementsApi = {
  list: (classId) => client.get('/requirements', { params: classId ? { class_id: classId } : {} }).then((r) => r.data),
  create: (data) => client.post('/requirements', data).then((r) => r.data),
  update: (id, data) => client.put(`/requirements/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/requirements/${id}`),
}

// ---- Constraints (LLM layer) ----
export const constraintsApi = {
  // `history` is [{role: 'user'|'assistant', text}], oldest first - lets the
  // LLM resolve short follow-up replies ("Kiran Rao") against what was
  // already established earlier in the conversation.
  parse: (text, history = []) => client.post('/constraints/parse', { text, history }).then((r) => r.data),
  save: (data) => client.post('/constraints', data).then((r) => r.data),
  list: (activeOnly = false) => client.get('/constraints', { params: { active_only: activeOnly } }).then((r) => r.data),
  update: (id, data) => client.put(`/constraints/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/constraints/${id}`),
}

// ---- Timetables ----
export const timetablesApi = {
  generate: (name) => client.post('/timetables/generate', { name }).then((r) => r.data),
  list: () => client.get('/timetables').then((r) => r.data),
  get: (id) => client.get(`/timetables/${id}`).then((r) => r.data),
  entries: (id, filters = {}) => client.get(`/timetables/${id}/entries`, { params: filters }).then((r) => r.data),
  explain: (id) => client.get(`/timetables/${id}/explain`).then((r) => r.data),
  moveEntry: (timetableId, entryId, dayId, periodId) =>
    client
      .put(`/timetables/${timetableId}/entries/${entryId}/move`, { day_id: dayId, period_id: periodId })
      .then((r) => r.data),
  remove: (id) => client.delete(`/timetables/${id}`),
  exportUrl: (id, format) => `/api/timetables/${id}/export/${format}`,
}

export default client
