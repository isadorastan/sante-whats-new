import { isValidWhatsAppPhone } from './phone.js'

const DAY_LABELS = {
  seg: 'Segunda',
  ter: 'Terça',
  qua: 'Quarta',
  qui: 'Quinta',
  sex: 'Sexta',
  sab: 'Sábado',
  dom: 'Domingo',
}

const WEEKDAY_ID = {
  Sun: 'dom',
  Mon: 'seg',
  Tue: 'ter',
  Wed: 'qua',
  Thu: 'qui',
  Fri: 'sex',
  Sat: 'sab',
}

function part(parts, type) {
  return parts.find((item) => item.type === type)?.value ?? ''
}

export function saoPauloClock(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)

  let hour = Number(part(parts, 'hour'))
  if (hour === 24) hour = 0

  return {
    date: `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`,
    hour,
  }
}

export function addIsoDays(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day + days))
  const y = utc.getUTCFullYear()
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const d = String(utc.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function weekdayId(isoDate) {
  const short = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).format(new Date(`${isoDate}T15:00:00Z`))
  return WEEKDAY_ID[short] ?? 'seg'
}

export function dayLabel(dayId) {
  return DAY_LABELS[dayId] ?? dayId
}

export function isSummaryDue({ hour, today, lastSummaryOn }) {
  if (hour < 21) return false
  if (lastSummaryOn == null || lastSummaryOn === '') return true
  return String(lastSummaryOn).slice(0, 10) !== today
}

export function buildSummaryText(label, rows) {
  const header = `Agenda de amanhã — ${label}`
  if (rows.length === 0) return `${header}\n\nNão tem aulas.`

  const byTime = new Map()
  for (const row of rows) {
    const names = byTime.get(row.time) ?? []
    names.push(row.name)
    byTime.set(row.time, names)
  }

  const lines = [...byTime.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, names]) => {
      const sorted = [...names].sort((a, b) => a.localeCompare(b, 'pt-BR'))
      return `${time} ${sorted.join(', ')}`
    })

  return `${header}\n\n${lines.join('\n')}`
}

async function loadRows(db, userId, day) {
  const { data: sessions, error } = await db
    .from('sessions')
    .select('time, student_id')
    .eq('user_id', userId)
    .eq('day', day)

  if (error) throw new Error(error.message)

  const ids = [...new Set((sessions ?? []).map((session) => session.student_id))]
  if (ids.length === 0) return []

  const { data: students, error: studentError } = await db
    .from('students')
    .select('id, name')
    .in('id', ids)

  if (studentError) throw new Error(studentError.message)

  const names = new Map((students ?? []).map((student) => [student.id, student.name]))
  return (sessions ?? [])
    .map((session) => ({
      time: session.time,
      name: names.get(session.student_id),
    }))
    .filter((row) => row.name)
}

let running = false

export async function runDailySummaries({
  db,
  isConnected,
  sendText,
  now = new Date(),
  force = false,
}) {
  if (!db || !isConnected()) return { sent: 0, reason: 'disconnected' }
  if (running) return { sent: 0, reason: 'busy' }
  running = true
  let sent = 0
  try {
    const clock = saoPauloClock(now)
    if (!force && clock.hour < 21) return { sent: 0, reason: 'early' }

    const { data: settings, error } = await db
      .from('professor_settings')
      .select('user_id, whatsapp_phone, last_summary_on')

    if (error) {
      console.error('resumo diário', error)
      return { sent: 0, reason: 'error' }
    }

    const tomorrow = addIsoDays(clock.date, 1)
    const day = weekdayId(tomorrow)
    const label = dayLabel(day)

    for (const row of settings ?? []) {
      const phone = String(row.whatsapp_phone ?? '').trim()
      if (!phone || !isValidWhatsAppPhone(phone)) continue
      if (
        !force &&
        !isSummaryDue({
          hour: clock.hour,
          today: clock.date,
          lastSummaryOn: row.last_summary_on,
        })
      ) {
        continue
      }

      try {
        const rows = await loadRows(db, row.user_id, day)
        await sendText(phone, buildSummaryText(label, rows))
        sent += 1
        if (!force) {
          const { error: updateError } = await db
            .from('professor_settings')
            .update({ last_summary_on: clock.date })
            .eq('user_id', row.user_id)
          if (updateError) console.error('resumo diário', updateError)
        }
      } catch (err) {
        console.error('resumo diário', row.user_id, err)
      }
    }

    return { sent }
  } finally {
    running = false
  }
}
