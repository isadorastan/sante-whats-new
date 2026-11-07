import { addIsoDays, weekdayId } from './dailySummary.js'

export const CLASS_DAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']
export const CLASS_MODALITIES = ['crossfit', 'hyrox']

const DAY_INDEX = {
  seg: 0,
  ter: 1,
  qua: 2,
  qui: 3,
  sex: 4,
  sab: 5,
  dom: 6,
}

export function parseModality(value) {
  return CLASS_MODALITIES.includes(value) ? value : null
}

export function parseDayList(value) {
  if (!Array.isArray(value)) return null
  const days = []
  for (const day of value) {
    if (!CLASS_DAYS.includes(day) || days.includes(day)) return null
    days.push(day)
  }
  return days
}

export function parseTime(value) {
  if (typeof value !== 'string') return null
  const time = value.trim().slice(0, 5)
  if (!/^\d{2}:\d{2}$/.test(time)) return null
  const [hour, minute] = time.split(':').map(Number)
  if (hour > 23 || minute > 59) return null
  return time
}

export function parseCapacity(value) {
  const capacity = Number(value)
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 500) return null
  return capacity
}

export function parseIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null
  }
  return value
}

export function parseMonth(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return null
  const month = Number(value.slice(5, 7))
  if (month < 1 || month > 12) return null
  return value
}

export function weekStartMonday(isoDate) {
  const day = weekdayId(isoDate)
  return addIsoDays(isoDate, -(DAY_INDEX[day] ?? 0))
}

export function dateForWeekday(weekStart, day) {
  return addIsoDays(weekStart, DAY_INDEX[day] ?? 0)
}

export function nextMonthStart(month) {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber, 1))
  const nextYear = date.getUTCFullYear()
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${nextYear}-${nextMonth}-01`
}

/** Check-in novo ou cancelamento: hoje, se o horário ainda não começou, e a semana que vem. */
export function checkinWindow({ today, nowTime, classDate, classTime }) {
  const thisMonday = weekStartMonday(today)
  const nextWeekEnd = addIsoDays(thisMonday, 13)
  if (classDate < today) return { ok: false, reason: 'past' }
  if (classDate > nextWeekEnd) return { ok: false, reason: 'too_far' }
  if (classDate === today && classTime <= nowTime) return { ok: false, reason: 'started' }
  return { ok: true }
}

export function isFutureCheckin({ today, nowTime, classDate, classTime }) {
  if (classDate > today) return true
  if (classDate === today && classTime > nowTime) return true
  return false
}

export function checkinDecision({
  today,
  nowTime,
  classDate,
  classTime,
  taken,
  capacity,
  alreadyIn,
}) {
  const window = checkinWindow({ today, nowTime, classDate, classTime })
  if (!window.ok) return window
  if (alreadyIn) return { ok: false, reason: 'duplicate' }
  if (taken >= capacity) return { ok: false, reason: 'full' }
  return { ok: true }
}

export function futureCheckinMessage(count, target) {
  const label = count === 1 ? '1 check-in futuro' : `${count} check-ins futuros`
  return `Isso cancela ${label} ${target}. O passado continua no resumo.`
}
