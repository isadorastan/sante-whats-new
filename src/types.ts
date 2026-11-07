export type DayOfWeek =
  | 'seg'
  | 'ter'
  | 'qua'
  | 'qui'
  | 'sex'
  | 'sab'
  | 'dom'

export type AppPage =
  | 'agenda'
  | 'turmas'
  | 'alunos'
  | 'estatisticas'
  | 'whatsapp'
  | 'configuracoes'

export type ClassModality = 'crossfit' | 'hyrox'

export interface ClassStudentAccount {
  id: number
  name: string
  email: string
  crossfit: boolean
  hyrox: boolean
}

export interface ClassSlot {
  id: number
  modality: ClassModality
  day: DayOfWeek
  time: string
  capacity: number
}

export interface ClassSchedule {
  modality: ClassModality
  days: DayOfWeek[]
  slots: ClassSlot[]
}

export interface ClassCheckinPerson {
  id: number
  studentName: string
  mine: boolean
}

export interface ClassWeekSlot {
  id: number
  time: string
  capacity: number
  checkins: ClassCheckinPerson[]
  canJoin: boolean
  canLeave: boolean
  myCheckinId: number | null
  closedReason?: 'past' | 'started' | 'too_far' | null
}

export interface ClassWeekDay {
  date: string
  day: DayOfWeek
  workout: string
  slots: ClassWeekSlot[]
}

export interface ClassWeek {
  weekStart: string
  today: string
  nowTime: string
  modalities: Partial<Record<ClassModality, { days: ClassWeekDay[] }>>
}

export interface ClassWorkoutDay {
  day: DayOfWeek
  date: string
  body: string
}

export interface ClassWorkoutWeek {
  modality: ClassModality
  weekStart: string
  days: ClassWorkoutDay[]
}

export interface ClassAttendanceSession {
  date: string
  time: string
  modality: ClassModality
  studentName: string
}

export interface ClassAttendanceRow {
  key: string
  studentId: number | null
  name: string
  crossfit: number
  hyrox: number
  sessions: ClassAttendanceSession[]
}

export interface StudioAttendance {
  month: string
  scope: 'studio'
  rows: ClassAttendanceRow[]
}

export interface MineAttendance {
  month: string
  scope: 'mine'
  name: string
  crossfit: number
  hyrox: number
  sessions: ClassAttendanceSession[]
}

export type StudentStatus = 'ativo' | 'pausado' | 'encerrado'

export interface Student {
  id: number
  name: string
  phone: string
  /** Quantas vezes por semana a pessoa treina */
  weeklyClasses: number
  /** Valor do plano em reais */
  planValue: number
  color: string
  status: StudentStatus
  /** YYYY-MM-DD */
  startedOn: string | null
  /** YYYY-MM-DD */
  endedOn: string | null
  /** Dia do mês, de 1 a 28 */
  billingDay: number | null
  /** Desconto combinado: fica fora da comparação com a tabela vigente */
  customPrice: boolean
}

export interface PlanPrice {
  weeklyClasses: number
  amount: number
}

export interface Payment {
  id: number
  studentId: number
  /** YYYY-MM */
  competence: string
  amount: number
  /** YYYY-MM-DD */
  dueOn: string | null
  /** YYYY-MM-DD */
  paidOn: string | null
}

export interface Session {
  id: number
  studentId: number
  day: DayOfWeek
  /** Horário no formato HH:mm */
  time: string
  durationMinutes: 45
}

export const DAYS: { id: DayOfWeek; label: string; short: string }[] = [
  { id: 'seg', label: 'Segunda', short: 'Seg' },
  { id: 'ter', label: 'Terça', short: 'Ter' },
  { id: 'qua', label: 'Quarta', short: 'Qua' },
  { id: 'qui', label: 'Quinta', short: 'Qui' },
  { id: 'sex', label: 'Sexta', short: 'Sex' },
  { id: 'sab', label: 'Sábado', short: 'Sáb' },
  { id: 'dom', label: 'Domingo', short: 'Dom' },
]

export const STUDENT_COLORS = [
  '#ff5a1f',
  '#5b8def',
  '#f5a524',
  '#ef5b7a',
  '#a78bfa',
  '#ff8a3d',
  '#fb923c',
  '#38bdf8',
]

const LEGACY_GREENS: Record<string, string> = {
  '#2dd4a8': '#ff5a1f',
  '#34d399': '#ff8a3d',
  '#1aa87a': '#c2410c',
  '#3dffa8': '#ff5a1f',
}

export function paintColor(color: string): string {
  return LEGACY_GREENS[color.toLowerCase()] ?? color
}

export function colorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i) * (i + 1)) % STUDENT_COLORS.length
  }
  return STUDENT_COLORS[hash]
}
