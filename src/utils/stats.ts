import { shiftMonth } from './dates'
import { DAYS, type DayOfWeek, type Payment, type PlanPrice, type Session, type Student } from '../types'

export type OutdatedFee = {
  student: Student
  tableAmount: number
  gap: number
}

export type IncompleteAgenda = {
  student: Student
  scheduled: number
}

export type OpenPayment = {
  student: Student
  payment: Payment
  late: boolean
}

export type BusinessStats = {
  revenue: number | null
  activeCount: number
  averageTicket: number | null
  revenuePerClass: number | null
  expected: number
  received: number | null
  overdueCount: number
  overdueAmount: number
  reajusteGap: number
  pausedCount: number
  newCount: number
  exitCount: number
  retention: { stayed: number; base: number } | null
  missingStartCount: number
  tenureActiveMonths: number | null
  tenureLeftMonths: number | null
  occupancy: number | null
  sessionCount: number
  slotCount: number
  peakTimes: { time: string; count: number }[]
  emptySlots: { day: DayOfWeek; time: string }[]
  incomplete: IncompleteAgenda[]
  outdated: OutdatedFee[]
  openPayments: OpenPayment[]
}

function cents(value: number): number {
  return Math.round(value * 100)
}

function fromCents(value: number): number {
  return value / 100
}

export function monthsBetween(startIso: string, endIso: string): number {
  const [startYear, startMonth, startDay] = startIso.split('-').map(Number)
  const [endYear, endMonth, endDay] = endIso.split('-').map(Number)
  let months = (endYear - startYear) * 12 + (endMonth - startMonth)
  if (endDay < startDay) months -= 1
  return Math.max(0, months)
}

function averageMonths(values: number[]): number | null {
  if (values.length === 0) return null
  const avg = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.round(avg * 10) / 10
}

function timeToMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function minutesToTime(value: number): string {
  const hour = Math.floor(value / 60)
  const minute = value % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function monthEnd(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const last = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()
  return `${month}-${String(last).padStart(2, '0')}`
}

function daysInMonth(month: string): number {
  return Number(monthEnd(month).slice(8))
}

/** Aluno presente naquele mês: início até o fim do mês e saída vazia ou no próprio mês. */
export function enrolledInMonth(student: Student, month: string): boolean {
  if (!student.startedOn) return false
  if (student.startedOn > monthEnd(month)) return false
  if (student.endedOn && student.endedOn < `${month}-01`) return false
  return true
}

export function earliestStatsMonth(
  students: Student[],
  payments: Payment[],
  currentMonth: string,
): string {
  const marks = [
    ...students.flatMap((student) => (student.startedOn ? [student.startedOn.slice(0, 7)] : [])),
    ...payments.map((payment) => payment.competence),
  ]
  if (marks.length === 0) return shiftMonth(currentMonth, -11)
  const earliest = marks.reduce((min, value) => (value < min ? value : min))
  return earliest > currentMonth ? currentMonth : earliest
}

export type MonthPoint = {
  month: string
  activeCount: number
  newCount: number
  exitCount: number
  revenue: number | null
  received: number | null
  overdueAmount: number
}

export function computeBusinessStats(input: {
  students: Student[]
  sessions: Session[]
  payments: Payment[]
  planPrices: PlanPrice[]
  month: string
  today: string
}): BusinessStats {
  const { students, sessions, payments, planPrices, month, today } = input
  const monthStart = `${month}-01`
  const isCurrent = month === today.slice(0, 7)
  const studentById = new Map(students.map((student) => [student.id, student]))
  const active = students.filter((student) =>
    isCurrent ? student.status === 'ativo' : enrolledInMonth(student, month),
  )
  const activeIds = new Set(active.map((student) => student.id))
  const countedStudents = isCurrent
    ? new Map(active.map((student) => [student.id, student]))
    : studentById

  const monthPayments = payments.filter(
    (payment) => payment.competence === month && countedStudents.has(payment.studentId),
  )
  const hasRecord = monthPayments.length > 0
  const revenueCents = isCurrent
    ? active.reduce((sum, student) => sum + cents(student.planValue), 0)
    : hasRecord
      ? monthPayments.reduce((sum, payment) => sum + cents(payment.amount), 0)
      : null
  const contracted = active.reduce((sum, student) => sum + student.weeklyClasses, 0)
  const revenue = revenueCents === null ? null : fromCents(revenueCents)

  const priceByWeekly = new Map(
    planPrices.map((price) => [price.weeklyClasses, price.amount]),
  )
  const outdated: OutdatedFee[] = []
  if (isCurrent) {
    for (const student of active) {
      if (student.customPrice) continue
      const tableAmount = priceByWeekly.get(student.weeklyClasses)
      if (tableAmount === undefined) continue
      const gapCents = cents(tableAmount) - cents(student.planValue)
      if (gapCents <= 0) continue
      outdated.push({ student, tableAmount, gap: fromCents(gapCents) })
    }
    outdated.sort(
      (a, b) => b.gap - a.gap || a.student.name.localeCompare(b.student.name, 'pt-BR'),
    )
  }

  const base = students.filter(
    (student) =>
      student.startedOn !== null &&
      student.startedOn < monthStart &&
      (student.endedOn === null || student.endedOn >= monthStart),
  )
  const exitsInBase = base.filter(
    (student) => student.endedOn !== null && student.endedOn.slice(0, 7) === month,
  )

  const sessionsByStudent = new Map<number, number>()
  const activeSessions: Session[] = []
  if (isCurrent) {
    for (const session of sessions) {
      if (!activeIds.has(session.studentId)) continue
      activeSessions.push(session)
      sessionsByStudent.set(
        session.studentId,
        (sessionsByStudent.get(session.studentId) ?? 0) + 1,
      )
    }
  }

  const timeCounts = new Map<string, number>()
  const emptySlots: { day: DayOfWeek; time: string }[] = []
  let slotCount = 0
  for (const day of DAYS) {
    const daySessions = activeSessions.filter((session) => session.day === day.id)
    if (daySessions.length === 0) continue
    const occupied = new Set<string>()
    let first = Number.POSITIVE_INFINITY
    let last = Number.NEGATIVE_INFINITY
    for (const session of daySessions) {
      occupied.add(session.time)
      timeCounts.set(session.time, (timeCounts.get(session.time) ?? 0) + 1)
      const minutes = timeToMinutes(session.time)
      first = Math.min(first, minutes)
      last = Math.max(last, minutes)
    }
    for (let minutes = first; minutes <= last; minutes += 30) {
      slotCount += 1
      const time = minutesToTime(minutes)
      if (!occupied.has(time)) emptySlots.push({ day: day.id, time })
    }
  }

  const dayOrder = new Map(DAYS.map((day, index) => [day.id, index]))
  emptySlots.sort(
    (a, b) =>
      (dayOrder.get(a.day) ?? 0) - (dayOrder.get(b.day) ?? 0) ||
      a.time.localeCompare(b.time),
  )

  const peakTimes = [...timeCounts.entries()]
    .map(([time, count]) => ({ time, count }))
    .sort((a, b) => b.count - a.count || a.time.localeCompare(b.time))
    .slice(0, 5)

  const incomplete = active
    .map((student) => ({
      student,
      scheduled: sessionsByStudent.get(student.id) ?? 0,
    }))
    .filter((item) => item.scheduled < item.student.weeklyClasses)
    .sort((a, b) => a.student.name.localeCompare(b.student.name, 'pt-BR'))

  let expectedCents = 0
  let receivedCents = 0
  let overdueCount = 0
  let overdueCents = 0
  const openPayments: OpenPayment[] = []
  for (const payment of monthPayments) {
    const student = countedStudents.get(payment.studentId)
    if (!student) continue
    expectedCents += cents(payment.amount)
    if (payment.paidOn) {
      receivedCents += cents(payment.amount)
      continue
    }
    const late = Boolean(payment.dueOn && payment.dueOn < today)
    if (late) {
      overdueCount += 1
      overdueCents += cents(payment.amount)
    }
    openPayments.push({ student, payment, late })
  }
  openPayments.sort((a, b) => {
    if (a.late !== b.late) return a.late ? -1 : 1
    const dueA = a.payment.dueOn ?? '9999-99-99'
    const dueB = b.payment.dueOn ?? '9999-99-99'
    return (
      dueA.localeCompare(dueB) ||
      a.student.name.localeCompare(b.student.name, 'pt-BR')
    )
  })

  return {
    revenue,
    activeCount: active.length,
    averageTicket:
      revenueCents === null || active.length === 0
        ? null
        : fromCents(Math.round(revenueCents / active.length)),
    revenuePerClass:
      revenueCents === null || contracted === 0
        ? null
        : fromCents(
            Math.round((revenueCents * 7) / (contracted * daysInMonth(month))),
          ),
    expected: fromCents(expectedCents),
    received: !isCurrent && !hasRecord ? null : fromCents(receivedCents),
    overdueCount,
    overdueAmount: fromCents(overdueCents),
    reajusteGap: fromCents(outdated.reduce((sum, item) => sum + cents(item.gap), 0)),
    pausedCount: students.filter(
      (student) =>
        student.status === 'pausado' &&
        (isCurrent || enrolledInMonth(student, month)),
    ).length,
    newCount: students.filter(
      (student) => student.startedOn !== null && student.startedOn.slice(0, 7) === month,
    ).length,
    exitCount: students.filter(
      (student) => student.endedOn !== null && student.endedOn.slice(0, 7) === month,
    ).length,
    retention:
      base.length > 0
        ? { stayed: base.length - exitsInBase.length, base: base.length }
        : null,
    missingStartCount: students.filter(
      (student) => student.status !== 'encerrado' && student.startedOn === null,
    ).length,
    tenureActiveMonths: averageMonths(
      active
        .filter((student) => student.startedOn)
        .map((student) =>
          monthsBetween(
            student.startedOn as string,
            isCurrent ? today : monthEnd(month),
          ),
        ),
    ),
    tenureLeftMonths: averageMonths(
      students
        .filter(
          (student) =>
            student.startedOn &&
            student.endedOn &&
            (isCurrent || student.endedOn <= monthEnd(month)),
        )
        .map((student) =>
          monthsBetween(student.startedOn as string, student.endedOn as string),
        ),
    ),
    occupancy: slotCount > 0 ? activeSessions.length / slotCount : null,
    sessionCount: activeSessions.length,
    slotCount,
    peakTimes,
    emptySlots,
    incomplete,
    outdated,
    openPayments,
  }
}

export function buildMonthSeries(input: {
  students: Student[]
  payments: Payment[]
  today: string
}): MonthPoint[] {
  const currentMonth = input.today.slice(0, 7)
  const start = earliestStatsMonth(input.students, input.payments, currentMonth)
  const points: MonthPoint[] = []

  for (let month = start; month <= currentMonth; month = shiftMonth(month, 1)) {
    const stats = computeBusinessStats({
      students: input.students,
      sessions: [],
      payments: input.payments,
      planPrices: [],
      month,
      today: input.today,
    })
    points.push({
      month,
      activeCount: stats.activeCount,
      newCount: stats.newCount,
      exitCount: stats.exitCount,
      revenue: stats.revenue,
      received: stats.received,
      overdueAmount: stats.overdueAmount,
    })
  }

  return points
}
