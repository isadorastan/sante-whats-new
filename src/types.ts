export type DayOfWeek =
  | 'seg'
  | 'ter'
  | 'qua'
  | 'qui'
  | 'sex'
  | 'sab'
  | 'dom'

export type IntervalMinutes = 15 | 30

export type AppPage = 'agenda' | 'alunos' | 'whatsapp'

export interface Student {
  id: number
  name: string
  phone: string
  /** Quantas vezes por semana a pessoa treina */
  weeklyClasses: number
  /** Valor do plano em reais */
  planValue: number
  color: string
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
  '#2dd4a8',
  '#5b8def',
  '#f5a524',
  '#ef5b7a',
  '#a78bfa',
  '#34d399',
  '#fb923c',
  '#38bdf8',
]

export function colorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash + name.charCodeAt(i) * (i + 1)) % STUDENT_COLORS.length
  }
  return STUDENT_COLORS[hash]
}
