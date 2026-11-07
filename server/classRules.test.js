import { expect, it } from 'vitest'
import {
  checkinDecision,
  checkinWindow,
  dateForWeekday,
  parseCapacity,
  parseTime,
  weekStartMonday,
} from './classRules.js'
import { requireProfessor, requireStudent, roleFromUser } from './auth.js'

const today = '2026-11-07'
const nowTime = '11:31'

function decision(overrides) {
  return checkinDecision({
    today,
    nowTime,
    classDate: '2026-11-07',
    classTime: '18:00',
    taken: 0,
    capacity: 12,
    alreadyIn: false,
    ...overrides,
  })
}

it('trata conta sem papel como professor e aluno só com role student', () => {
  expect(roleFromUser({ app_metadata: {} })).toBe('professor')
  expect(roleFromUser(undefined)).toBe('professor')
  expect(roleFromUser({ app_metadata: { role: 'student', professor_id: 'p1' } })).toBe(
    'student',
  )
})

it('bloqueia o aluno nas rotas do professor e o professor nas rotas do aluno', () => {
  const studentRes = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body } }
  let studentNext = false
  requireProfessor({ user: { role: 'student' } }, studentRes, () => {
    studentNext = true
  })
  expect(studentNext).toBe(false)
  expect(studentRes.statusCode).toBe(403)
  expect(studentRes.body.error).toBe('Acesso só do professor')

  const professorRes = { statusCode: 0, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body } }
  let professorNext = false
  requireStudent({ user: { role: 'professor' } }, professorRes, () => {
    professorNext = true
  })
  expect(professorNext).toBe(false)
  expect(professorRes.statusCode).toBe(403)

  let allowed = false
  requireProfessor({ user: { role: 'professor' } }, studentRes, () => {
    allowed = true
  })
  expect(allowed).toBe(true)
})

it('aceita check-in hoje se o horário ainda não passou, e na semana que vem', () => {
  expect(weekStartMonday(today)).toBe('2026-11-02')
  expect(dateForWeekday('2026-11-02', 'dom')).toBe('2026-11-08')
  expect(decision({ classTime: '11:32' }).ok).toBe(true)
  expect(decision({ classDate: '2026-11-09', classTime: '06:00' }).ok).toBe(true)
  expect(decision({ classDate: '2026-11-15', classTime: '20:00' }).ok).toBe(true)
})

it('recusa horário passado, semana seguinte à próxima, vaga esgotada e quem já entrou', () => {
  expect(checkinWindow({ today, nowTime, classDate: '2026-11-06', classTime: '18:00' })).toEqual({
    ok: false,
    reason: 'past',
  })
  expect(decision({ classTime: '11:31' })).toMatchObject({ ok: false, reason: 'started' })
  expect(decision({ classTime: '11:30' })).toMatchObject({ ok: false, reason: 'started' })
  expect(decision({ classDate: '2026-11-16', classTime: '06:00' })).toMatchObject({
    ok: false,
    reason: 'too_far',
  })
  expect(decision({ taken: 12, capacity: 12 })).toMatchObject({ ok: false, reason: 'full' })
  expect(decision({ taken: 11, capacity: 12 }).ok).toBe(true)
  expect(decision({ alreadyIn: true })).toMatchObject({ ok: false, reason: 'duplicate' })
})

it('só aceita horário e vagas válidos', () => {
  expect(parseTime('07:00')).toBe('07:00')
  expect(parseTime('07:00:00')).toBe('07:00')
  expect(parseTime('24:00')).toBeNull()
  expect(parseCapacity(12)).toBe(12)
  expect(parseCapacity(0)).toBeNull()
  expect(parseCapacity(1.5)).toBeNull()
})
