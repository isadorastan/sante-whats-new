import type { DayOfWeek, Session, Student } from '../types'
import { apiFetch } from './http'

export type StudentInput = Omit<Student, 'id'>
export type StudentUpdate = Partial<Omit<Student, 'id'>>

export type SessionInput = {
  studentId: number
  day: DayOfWeek
  time: string
  durationMinutes?: number
}

export type SessionUpdate = {
  day?: DayOfWeek
  time?: string
  durationMinutes?: number
  studentId?: number
}

export type SessionBulkItem = {
  id: number
  day?: DayOfWeek
  time?: string
  durationMinutes?: number
}

async function parseJson<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const data = (await res.json().catch(() => null)) as
    | T
    | { error?: string }
    | null
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && data.error
        ? String(data.error)
        : `Erro HTTP ${res.status}`
    throw new Error(message)
  }
  return data as T
}

export async function fetchStudents(): Promise<Student[]> {
  const res = await apiFetch('/api/students')
  return parseJson<Student[]>(res)
}

export async function createStudent(input: StudentInput): Promise<Student> {
  const res = await apiFetch('/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<Student>(res)
}

export async function updateStudent(
  id: number,
  input: StudentUpdate,
): Promise<Student> {
  const res = await apiFetch(`/api/students/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<Student>(res)
}

export async function deleteStudent(id: number): Promise<void> {
  const res = await apiFetch(`/api/students/${id}`, { method: 'DELETE' })
  await parseJson<void>(res)
}

export async function fetchSessions(day?: DayOfWeek): Promise<Session[]> {
  const url = day ? `/api/sessions?day=${day}` : '/api/sessions'
  const res = await apiFetch(url)
  return parseJson<Session[]>(res)
}

export async function createSession(input: SessionInput): Promise<Session> {
  const res = await apiFetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<Session>(res)
}

export async function updateSession(
  id: number,
  input: SessionUpdate,
): Promise<Session> {
  const res = await apiFetch(`/api/sessions/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<Session>(res)
}

export async function updateSessionsBulk(
  items: SessionBulkItem[],
): Promise<Session[]> {
  const res = await apiFetch('/api/sessions/bulk', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items),
  })
  return parseJson<Session[]>(res)
}

export async function deleteSession(id: number): Promise<void> {
  const res = await apiFetch(`/api/sessions/${id}`, { method: 'DELETE' })
  await parseJson<void>(res)
}
