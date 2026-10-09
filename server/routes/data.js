import { Router } from 'express'
import { brazilMonth, brazilToday } from '../dates.js'
import { mapPayment, mapPlanPrice, mapSession, mapStudent, requireDb } from '../db.js'

const DAYS = new Set(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'])
const STATUSES = new Set(['ativo', 'pausado', 'encerrado'])

export const dataRouter = Router()

function parseId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function ownerId(req, res) {
  const id = req.user?.id
  if (typeof id !== 'string' || !id) {
    res.status(401).json({ error: 'Não autenticado' })
    return null
  }
  return id
}

async function ownsStudent(db, userId, studentId) {
  const { data, error } = await db
    .from('students')
    .select('id, status, plan_value, billing_day')
    .eq('id', studentId)
    .eq('user_id', userId)
    .maybeSingle()
  return { student: data, error }
}

/** null = vazio, undefined = inválido. */
function parseIsoDate(value) {
  if (value === null || value === '') return null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined
  }
  return value
}

/** null = sem vencimento, undefined = inválido. */
function parseBillingDay(value) {
  if (value === null || value === '') return null
  const day = Number(value)
  if (!Number.isInteger(day) || day < 1 || day > 28) return undefined
  return day
}

function parseMonth(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}$/.test(value)) return null
  const month = Number(value.slice(5, 7))
  if (month < 1 || month > 12) return null
  return value
}

function dueOnFor(month, billingDay) {
  if (billingDay === null || billingDay === undefined) return null
  return `${month}-${String(billingDay).padStart(2, '0')}`
}

function readStudentExtras(body, { creating }) {
  const patch = {}

  if (body.status !== undefined) {
    if (!STATUSES.has(body.status)) {
      return { error: 'Situação inválida' }
    }
    patch.status = body.status
  } else if (creating) {
    patch.status = 'ativo'
  }

  if (body.startedOn !== undefined) {
    const startedOn = parseIsoDate(body.startedOn)
    if (startedOn === undefined) return { error: 'Data de início inválida' }
    patch.started_on = startedOn
  } else if (creating) {
    patch.started_on = null
  }

  if (body.billingDay !== undefined) {
    const billingDay = parseBillingDay(body.billingDay)
    if (billingDay === undefined) {
      return { error: 'Dia de vencimento inválido (1–28)' }
    }
    patch.billing_day = billingDay
  } else if (creating) {
    patch.billing_day = null
  }

  if (body.customPrice !== undefined) {
    if (typeof body.customPrice !== 'boolean') {
      return { error: 'Valor combinado inválido' }
    }
    patch.custom_price = body.customPrice
  } else if (creating) {
    patch.custom_price = false
  }

  const status = patch.status
  if (body.endedOn !== undefined || status !== undefined) {
    const endedOn =
      body.endedOn === undefined ? undefined : parseIsoDate(body.endedOn)
    if (body.endedOn !== undefined && endedOn === undefined) {
      return { error: 'Data de saída inválida' }
    }
    if (status === 'ativo' || status === 'pausado') {
      patch.ended_on = null
    } else if (status === 'encerrado') {
      if (!endedOn) return { error: 'Informe a data de saída' }
      patch.ended_on = endedOn
    } else if (endedOn !== undefined) {
      patch.ended_on = endedOn
    }
  }

  return { patch }
}

// --- Students ---

dataRouter.get('/students', async (req, res) => {
  const db = requireDb(res)
  if (!db) return
  const userId = ownerId(req, res)
  if (!userId) return

  const { data, error } = await db
    .from('students')
    .select('*')
    .eq('user_id', userId)
    .order('name', { ascending: true })

  if (error) {
    console.error('GET /students', error)
    res.status(500).json({ error: error.message })
    return
  }

  res.json((data ?? []).map(mapStudent))
})

dataRouter.post('/students', async (req, res) => {
  const db = requireDb(res)
  if (!db) return
  const userId = ownerId(req, res)
  if (!userId) return

  const { name, phone, weeklyClasses, planValue, color } = req.body ?? {}
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Nome é obrigatório' })
    return
  }
  if (!color || typeof color !== 'string') {
    res.status(400).json({ error: 'Cor é obrigatória' })
    return
  }

  const weekly = Number(weeklyClasses)
  const plan = Number(planValue)
  if (!Number.isInteger(weekly) || weekly < 1 || weekly > 7) {
    res.status(400).json({ error: 'weeklyClasses inválido (1–7)' })
    return
  }
  if (!Number.isFinite(plan) || plan < 0) {
    res.status(400).json({ error: 'planValue inválido' })
    return
  }

  const extras = readStudentExtras(req.body ?? {}, { creating: true })
  if (extras.error) {
    res.status(400).json({ error: extras.error })
    return
  }

  const { data, error } = await db
    .from('students')
    .insert({
      user_id: userId,
      name: name.trim(),
      phone: String(phone ?? '').replace(/\D/g, ''),
      weekly_classes: weekly,
      plan_value: plan,
      color,
      ...extras.patch,
    })
    .select('*')
    .single()

  if (error) {
    console.error('POST /students', error)
    res.status(500).json({ error: error.message })
    return
  }

  res.status(201).json(mapStudent(data))
})

dataRouter.patch('/students/:id', async (req, res) => {
  const db = requireDb(res)
  if (!db) return
  const userId = ownerId(req, res)
  if (!userId) return

  const id = parseId(req.params.id)
  if (!id) {
    res.status(400).json({ error: 'Id inválido' })
    return
  }

  const body = req.body ?? {}
  const patch = {}

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) {
      res.status(400).json({ error: 'Nome inválido' })
      return
    }
    patch.name = body.name.trim()
  }
  if (body.phone !== undefined) {
    patch.phone = String(body.phone).replace(/\D/g, '')
  }
  if (body.weeklyClasses !== undefined) {
    const weekly = Number(body.weeklyClasses)
    if (!Number.isInteger(weekly) || weekly < 1 || weekly > 7) {
      res.status(400).json({ error: 'weeklyClasses inválido (1–7)' })
      return
    }
    patch.weekly_classes = weekly
  }
  if (body.planValue !== undefined) {
    const plan = Number(body.planValue)
    if (!Number.isFinite(plan) || plan < 0) {
      res.status(400).json({ error: 'planValue inválido' })
      return
    }
    patch.plan_value = plan
  }
  if (body.color !== undefined) {
    if (typeof body.color !== 'string' || !body.color) {
      res.status(400).json({ error: 'Cor inválida' })
      return
    }
    patch.color = body.color
  }

  const extras = readStudentExtras(body, { creating: false })
  if (extras.error) {
    res.status(400).json({ error: extras.error })
    return
  }
  Object.assign(patch, extras.patch)

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'Nenhum campo para atualizar' })
    return
  }

  const { data, error } = await db
    .from('students')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    console.error('PATCH /students/:id', error)
    const status = error.code === 'PGRST116' ? 404 : 500
    res.status(status).json({ error: error.message })
    return
  }

  res.json(mapStudent(data))
})

dataRouter.delete('/students/:id', async (req, res) => {
  const db = requireDb(res)
  if (!db) return
  const userId = ownerId(req, res)
  if (!userId) return

  const id = parseId(req.params.id)
  if (!id) {
    res.status(400).json({ error: 'Id inválido' })
    return
  }

  const { data, error } = await db
    .from('students')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')

  if (error) {
    console.error('DELETE /students/:id', error)
    res.status(500).json({ error: error.message })
    return
  }
  if (!data?.length) {
    res.status(404).json({ error: 'Aluno não encontrado' })
    return
  }

  res.status(204).send()
})

// --- Plan prices ---

dataRouter.get('/plan-prices', async (req, res) => {
  const db = requireDb(res)
  if (!db) return
  const userId = ownerId(req, res)
  if (!userId) return

  const { data, error } = await db
    .from('plan_prices')
    .select('*')
    .eq('user_id', userId)
    .order('weekly_classes', { ascending: true })

  if (error) {
    console.error('GET /plan-prices', error)
    res.status(500).json({ error: error.message })
    return
  }

  res.json((data ?? []).map(mapPlanPrice))
})

dataRouter.put('/plan-prices', async (req, res) => {
  const db = requireDb(res)
  if (!db) return
  const userId = ownerId(req, res)
  if (!userId) return

  const items = req.body
  if (!Array.isArray(items)) {
    res.status(400).json({ error: 'Envie a tabela de preços' })
    return
  }

  const rows = []
  const seen = new Set()
  for (const item of items) {
    const weekly = Number(item?.weeklyClasses)
    const amount = Number(item?.amount)
    if (!Number.isInteger(weekly) || weekly < 1 || weekly > 7) {
      res.status(400).json({ error: 'weeklyClasses inválido (1–7)' })
      return
    }
    if (!Number.isFinite(amount) || amount < 0) {
      res.status(400).json({ error: 'Valor da tabela inválido' })
      return
    }
    if (seen.has(weekly)) {
      res.status(400).json({ error: 'Frequência repetida na tabela' })
      return
    }
    seen.add(weekly)
    rows.push({
      user_id: userId,
      weekly_classes: weekly,
      amount,
    })
  }

  const { error: deleteError } = await db
    .from('plan_prices')
    .delete()
    .eq('user_id', userId)

  if (deleteError) {
    console.error('PUT /plan-prices', deleteError)
    res.status(500).json({ error: deleteError.message })
    return
  }

  if (rows.length > 0) {
    const { error: insertError } = await db.from('plan_prices').insert(rows)
    if (insertError) {
      console.error('PUT /plan-prices', insertError)
      res.status(500).json({ error: insertError.message })
      return
    }
  }

  res.json(rows.map(mapPlanPrice).sort((a, b) => a.weeklyClasses - b.weeklyClasses))
})

// --- Payments ---

async function readPayments(db, userId, month) {
  let query = db
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .order('competence', { ascending: true })
    .order('due_on', { ascending: true })

  if (month) query = query.eq('competence', `${month}-01`)

  const { data, error } = await query
  if (error) return { error }
  return { payments: (data ?? []).map(mapPayment) }
}

async function loadMonthPayments(db, userId, month, { write }) {
  if (!write) return readPayments(db, userId, month)

  const competence = `${month}-01`
  const { data: students, error: studentError } = await db
    .from('students')
    .select('id, plan_value, billing_day, status')
    .eq('user_id', userId)
    .eq('status', 'ativo')

  if (studentError) return { error: studentError }

  const { data: existing, error: paymentError } = await db
    .from('payments')
    .select('*')
    .eq('user_id', userId)
    .eq('competence', competence)

  if (paymentError) return { error: paymentError }

  const byStudent = new Map(
    (existing ?? []).map((row) => [Number(row.student_id), row]),
  )
  const missing = []

  for (const student of students ?? []) {
    const current = byStudent.get(Number(student.id))
    const dueOn = dueOnFor(month, student.billing_day)
    const amount = Number(student.plan_value)
    if (!current) {
      missing.push({
        user_id: userId,
        student_id: student.id,
        competence,
        amount,
        due_on: dueOn,
        paid_on: null,
      })
      continue
    }
    if (current.paid_on) continue
    const sameAmount =
      Math.round(Number(current.amount) * 100) === Math.round(amount * 100)
    const sameDue = (current.due_on ? String(current.due_on).slice(0, 10) : null) === dueOn
    if (sameAmount && sameDue) continue

    const { error: updateError } = await db
      .from('payments')
      .update({ amount, due_on: dueOn })
      .eq('id', current.id)
      .eq('user_id', userId)

    if (updateError) return { error: updateError }
  }

  if (missing.length > 0) {
    const { error: insertError } = await db.from('payments').insert(missing)
    if (insertError) return { error: insertError }
  }

  return readPayments(db, userId, month)
}

dataRouter.get('/payments', async (req, res) => {
  const db = requireDb(res)
  if (!db) return
  const userId = ownerId(req, res)
  if (!userId) return

  if (req.query.scope === 'all') {
    const result = await readPayments(db, userId)
    if (result.error) {
      console.error('GET /payments?scope=all', result.error)
      res.status(500).json({ error: result.error.message })
      return
    }
    res.json(result.payments)
    return
  }

  const currentMonth = brazilMonth()
  const month =
    req.query.month === undefined
      ? currentMonth
      : parseMonth(String(req.query.month))
  if (!month) {
    res.status(400).json({ error: 'Mês inválido (YYYY-MM)' })
    return
  }
  if (month > currentMonth) {
    res.status(400).json({ error: 'Mês futuro' })
    return
  }

  const result = await loadMonthPayments(db, userId, month, {
    write: month === currentMonth,
  })
  if (result.error) {
    console.error('GET /payments', result.error)
    res.status(500).json({ error: result.error.message })
    return
  }

  res.json(result.payments)
})

dataRouter.post('/payments/:studentId/pay', async (req, res) => {
  const db = requireDb(res)
  if (!db) return
  const userId = ownerId(req, res)
  if (!userId) return

  const studentId = parseId(req.params.studentId)
  if (!studentId) {
    res.status(400).json({ error: 'Id inválido' })
    return
  }

  const currentMonth = brazilMonth()
  const month =
    req.body?.month === undefined ? currentMonth : parseMonth(req.body.month)
  if (!month) {
    res.status(400).json({ error: 'Mês inválido (YYYY-MM)' })
    return
  }
  if (month > currentMonth) {
    res.status(400).json({ error: 'Mês futuro' })
    return
  }

  const owned = await ownsStudent(db, userId, studentId)
  if (owned.error) {
    console.error('POST /payments/:studentId/pay', owned.error)
    res.status(500).json({ error: owned.error.message })
    return
  }
  if (!owned.student) {
    res.status(404).json({ error: 'Aluno não encontrado' })
    return
  }
  if (month === currentMonth && owned.student.status !== 'ativo') {
    res.status(400).json({ error: 'Só alunos ativos entram no pagamento do mês' })
    return
  }

  if (month === currentMonth) {
    const ensured = await loadMonthPayments(db, userId, month, { write: true })
    if (ensured.error) {
      console.error('POST /payments/:studentId/pay', ensured.error)
      res.status(500).json({ error: ensured.error.message })
      return
    }
  }

  const today = brazilToday()
  const { data, error } = await db
    .from('payments')
    .update({ paid_on: today })
    .eq('user_id', userId)
    .eq('student_id', studentId)
    .eq('competence', `${month}-01`)
    .select('*')
    .single()

  if (error) {
    console.error('POST /payments/:studentId/pay', error)
    const status = error.code === 'PGRST116' ? 404 : 500
    res.status(status).json({
      error:
        status === 404 ? 'Pagamento não registrado neste mês' : error.message,
    })
    return
  }

  res.json(mapPayment(data))
})

dataRouter.post('/payments/:studentId/unpay', async (req, res) => {
  const db = requireDb(res)
  if (!db) return
  const userId = ownerId(req, res)
  if (!userId) return

  const studentId = parseId(req.params.studentId)
  if (!studentId) {
    res.status(400).json({ error: 'Id inválido' })
    return
  }

  const currentMonth = brazilMonth()
  const month =
    req.body?.month === undefined ? currentMonth : parseMonth(req.body.month)
  if (!month) {
    res.status(400).json({ error: 'Mês inválido (YYYY-MM)' })
    return
  }
  if (month > currentMonth) {
    res.status(400).json({ error: 'Mês futuro' })
    return
  }

  const owned = await ownsStudent(db, userId, studentId)
  if (owned.error) {
    console.error('POST /payments/:studentId/unpay', owned.error)
    res.status(500).json({ error: owned.error.message })
    return
  }
  if (!owned.student) {
    res.status(404).json({ error: 'Aluno não encontrado' })
    return
  }

  const { data, error } = await db
    .from('payments')
    .update({ paid_on: null })
    .eq('user_id', userId)
    .eq('student_id', studentId)
    .eq('competence', `${month}-01`)
    .select('*')
    .single()

  if (error) {
    console.error('POST /payments/:studentId/unpay', error)
    const status = error.code === 'PGRST116' ? 404 : 500
    res.status(status).json({
      error:
        status === 404 ? 'Pagamento não registrado neste mês' : error.message,
    })
    return
  }

  res.json(mapPayment(data))
})

// --- Sessions ---

dataRouter.get('/sessions', async (req, res) => {
  const db = requireDb(res)
  if (!db) return
  const userId = ownerId(req, res)
  if (!userId) return

  let query = db
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .order('day')
    .order('time')

  const day = req.query.day
  if (typeof day === 'string' && day) {
    if (!DAYS.has(day)) {
      res.status(400).json({ error: 'day inválido' })
      return
    }
    query = query.eq('day', day)
  }

  const { data, error } = await query

  if (error) {
    console.error('GET /sessions', error)
    res.status(500).json({ error: error.message })
    return
  }

  res.json((data ?? []).map(mapSession))
})

dataRouter.post('/sessions', async (req, res) => {
  const db = requireDb(res)
  if (!db) return
  const userId = ownerId(req, res)
  if (!userId) return

  const { studentId, day, time, durationMinutes } = req.body ?? {}
  const sid = parseId(studentId)
  if (!sid) {
    res.status(400).json({ error: 'studentId inválido' })
    return
  }
  if (!DAYS.has(day)) {
    res.status(400).json({ error: 'day inválido' })
    return
  }
  if (typeof time !== 'string' || !/^\d{2}:\d{2}$/.test(time)) {
    res.status(400).json({ error: 'time inválido (HH:mm)' })
    return
  }

  const duration =
    durationMinutes === undefined ? 45 : Number(durationMinutes)
  if (!Number.isInteger(duration) || duration <= 0) {
    res.status(400).json({ error: 'durationMinutes inválido' })
    return
  }

  const owned = await ownsStudent(db, userId, sid)
  if (owned.error) {
    console.error('POST /sessions', owned.error)
    res.status(500).json({ error: owned.error.message })
    return
  }
  if (!owned.student) {
    res.status(404).json({ error: 'Aluno não encontrado' })
    return
  }

  const { data, error } = await db
    .from('sessions')
    .insert({
      user_id: userId,
      student_id: sid,
      day,
      time,
      duration_minutes: duration,
    })
    .select('*')
    .single()

  if (error) {
    console.error('POST /sessions', error)
    const status = error.code === '23505' ? 409 : 500
    res.status(status).json({
      error:
        error.code === '23505'
          ? 'Aluno já está neste horário'
          : error.message,
    })
    return
  }

  res.status(201).json(mapSession(data))
})

// bulk BEFORE :id
dataRouter.patch('/sessions/bulk', async (req, res) => {
  const db = requireDb(res)
  if (!db) return
  const userId = ownerId(req, res)
  if (!userId) return

  const items = req.body
  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Envie um array de { id, day?, time? }' })
    return
  }

  const updated = []

  for (const item of items) {
    const id = parseId(item?.id)
    if (!id) {
      res.status(400).json({ error: 'Item com id inválido' })
      return
    }

    const patch = {}
    if (item.day !== undefined) {
      if (!DAYS.has(item.day)) {
        res.status(400).json({ error: `day inválido no id ${id}` })
        return
      }
      patch.day = item.day
    }
    if (item.time !== undefined) {
      if (typeof item.time !== 'string' || !/^\d{2}:\d{2}$/.test(item.time)) {
        res.status(400).json({ error: `time inválido no id ${id}` })
        return
      }
      patch.time = item.time
    }
    if (item.durationMinutes !== undefined) {
      const duration = Number(item.durationMinutes)
      if (!Number.isInteger(duration) || duration <= 0) {
        res.status(400).json({ error: `durationMinutes inválido no id ${id}` })
        return
      }
      patch.duration_minutes = duration
    }

    if (Object.keys(patch).length === 0) continue

    const { data, error } = await db
      .from('sessions')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single()

    if (error) {
      console.error('PATCH /sessions/bulk', error)
      const status = error.code === 'PGRST116' ? 404 : 500
      res.status(status).json({
        error: status === 404 ? 'Sessão não encontrada' : error.message,
      })
      return
    }

    updated.push(mapSession(data))
  }

  res.json(updated)
})

dataRouter.patch('/sessions/:id', async (req, res) => {
  const db = requireDb(res)
  if (!db) return
  const userId = ownerId(req, res)
  if (!userId) return

  const id = parseId(req.params.id)
  if (!id) {
    res.status(400).json({ error: 'Id inválido' })
    return
  }

  const body = req.body ?? {}
  const patch = {}

  if (body.day !== undefined) {
    if (!DAYS.has(body.day)) {
      res.status(400).json({ error: 'day inválido' })
      return
    }
    patch.day = body.day
  }
  if (body.time !== undefined) {
    if (typeof body.time !== 'string' || !/^\d{2}:\d{2}$/.test(body.time)) {
      res.status(400).json({ error: 'time inválido (HH:mm)' })
      return
    }
    patch.time = body.time
  }
  if (body.durationMinutes !== undefined) {
    const duration = Number(body.durationMinutes)
    if (!Number.isInteger(duration) || duration <= 0) {
      res.status(400).json({ error: 'durationMinutes inválido' })
      return
    }
    patch.duration_minutes = duration
  }
  if (body.studentId !== undefined) {
    const sid = parseId(body.studentId)
    if (!sid) {
      res.status(400).json({ error: 'studentId inválido' })
      return
    }
    const owned = await ownsStudent(db, userId, sid)
    if (owned.error) {
      console.error('PATCH /sessions/:id', owned.error)
      res.status(500).json({ error: owned.error.message })
      return
    }
    if (!owned.student) {
      res.status(404).json({ error: 'Aluno não encontrado' })
      return
    }
    patch.student_id = sid
  }

  if (Object.keys(patch).length === 0) {
    res.status(400).json({ error: 'Nenhum campo para atualizar' })
    return
  }

  const { data, error } = await db
    .from('sessions')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (error) {
    console.error('PATCH /sessions/:id', error)
    const status =
      error.code === 'PGRST116' ? 404 : error.code === '23505' ? 409 : 500
    res.status(status).json({ error: error.message })
    return
  }

  res.json(mapSession(data))
})

dataRouter.delete('/sessions/:id', async (req, res) => {
  const db = requireDb(res)
  if (!db) return
  const userId = ownerId(req, res)
  if (!userId) return

  const id = parseId(req.params.id)
  if (!id) {
    res.status(400).json({ error: 'Id inválido' })
    return
  }

  const { data, error } = await db
    .from('sessions')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')

  if (error) {
    console.error('DELETE /sessions/:id', error)
    res.status(500).json({ error: error.message })
    return
  }
  if (!data?.length) {
    res.status(404).json({ error: 'Sessão não encontrada' })
    return
  }

  res.status(204).send()
})
