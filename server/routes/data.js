import { Router } from 'express'
import { mapSession, mapStudent, requireDb } from '../db.js'

const DAYS = new Set(['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'])

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
    .select('id')
    .eq('id', studentId)
    .eq('user_id', userId)
    .maybeSingle()
  return { ok: Boolean(data), error }
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

  const { data, error } = await db
    .from('students')
    .insert({
      user_id: userId,
      name: name.trim(),
      phone: String(phone ?? '').replace(/\D/g, ''),
      weekly_classes: weekly,
      plan_value: plan,
      color,
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
  if (!owned.ok) {
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
    if (!owned.ok) {
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
