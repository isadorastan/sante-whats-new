import type {
  ClassModality,
  ClassSchedule,
  ClassSlot,
  ClassStudentAccount,
  ClassWeek,
  ClassWorkoutWeek,
  DayOfWeek,
  MineAttendance,
  StudioAttendance,
} from '../types'
import { apiFetch } from './http'

export class NeedsConfirmError extends Error {
  futureCount: number

  constructor(message: string, futureCount: number) {
    super(message)
    this.name = 'NeedsConfirmError'
    this.futureCount = futureCount
  }
}

async function parseClass<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T
  const data = (await res.json().catch(() => null)) as
    | (T & { error?: string; needsConfirm?: boolean; futureCount?: number })
    | null
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && data.error
        ? String(data.error)
        : `Erro HTTP ${res.status}`
    if (res.status === 409 && data && data.needsConfirm) {
      throw new NeedsConfirmError(message, Number(data.futureCount ?? 0))
    }
    throw new Error(message)
  }
  return data as T
}

export async function fetchClassStudents(): Promise<ClassStudentAccount[]> {
  const res = await apiFetch('/api/class/students')
  return parseClass(res)
}

export async function createClassStudent(input: {
  name: string
  phone: string
  username: string
  password: string
  crossfit: boolean
  hyrox: boolean
}): Promise<ClassStudentAccount & { whatsappSent: boolean; whatsappError: string | null }> {
  const res = await apiFetch('/api/class/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseClass(res)
}

export async function updateClassStudent(
  id: number,
  input: { crossfit?: boolean; hyrox?: boolean; name?: string; phone?: string },
): Promise<ClassStudentAccount> {
  const res = await apiFetch(`/api/class/students/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseClass(res)
}

export async function resendClassStudent(id: number): Promise<{
  whatsappSent: boolean
  whatsappError: string | null
  password: string | null
}> {
  const res = await apiFetch(`/api/class/students/${id}/resend`, { method: 'POST' })
  return parseClass(res)
}

export async function deleteClassStudent(id: number): Promise<void> {
  const res = await apiFetch(`/api/class/students/${id}`, { method: 'DELETE' })
  await parseClass(res)
}

export async function fetchClassSchedule(
  modality: ClassModality,
): Promise<ClassSchedule> {
  const res = await apiFetch(`/api/class/schedule?modality=${modality}`)
  return parseClass(res)
}

export async function saveClassDays(input: {
  modality: ClassModality
  days: DayOfWeek[]
  confirm?: boolean
}): Promise<void> {
  const res = await apiFetch('/api/class/days', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  await parseClass(res)
}

export async function createClassSlot(input: {
  modality: ClassModality
  day: DayOfWeek
  time: string
  capacity: number
}): Promise<ClassSlot> {
  const res = await apiFetch('/api/class/slots', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseClass(res)
}

export async function updateClassSlot(
  id: number,
  input: { time: string; capacity: number },
): Promise<ClassSlot> {
  const res = await apiFetch(`/api/class/slots/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseClass(res)
}

export async function deleteClassSlot(id: number, confirm = false): Promise<void> {
  const query = confirm ? '?confirm=1' : ''
  const res = await apiFetch(`/api/class/slots/${id}${query}`, { method: 'DELETE' })
  await parseClass(res)
}

export async function fetchClassWorkouts(
  modality: ClassModality,
  week: string,
): Promise<ClassWorkoutWeek> {
  const res = await apiFetch(
    `/api/class/workouts?modality=${modality}&week=${week}`,
  )
  return parseClass(res)
}

export async function assistClassWorkout(prompt: string): Promise<string> {
  const res = await apiFetch('/api/class/workouts/assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt }),
  })
  const data = await parseClass<{ text: string }>(res)
  return data.text
}

export async function saveClassWorkout(input: {
  modality: ClassModality
  date: string
  body: string
}): Promise<void> {
  const res = await apiFetch('/api/class/workouts', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  await parseClass(res)
}

export async function fetchStudioAttendance(month: string): Promise<StudioAttendance> {
  const res = await apiFetch(`/api/class/attendance?month=${month}`)
  return parseClass(res)
}

export async function fetchClassWeek(from: string): Promise<ClassWeek> {
  const res = await apiFetch(`/api/class/week?from=${from}`)
  return parseClass(res)
}

export async function createCheckin(slotId: number, date: string): Promise<void> {
  const res = await apiFetch('/api/class/checkins', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slotId, date }),
  })
  await parseClass(res)
}

export async function cancelCheckin(id: number): Promise<void> {
  const res = await apiFetch(`/api/class/checkins/${id}`, { method: 'DELETE' })
  await parseClass(res)
}

export async function fetchMyAttendance(month: string): Promise<MineAttendance> {
  const res = await apiFetch(`/api/class/attendance?month=${month}`)
  return parseClass(res)
}