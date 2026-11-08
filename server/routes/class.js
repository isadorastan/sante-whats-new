import { Router } from 'express'
import { requireProfessor, requireStudent } from '../auth.js'
import {
  checkinDecision,
  checkinWindow,
  dateForWeekday,
  futureCheckinMessage,
  isFutureCheckin,
  nextMonthStart,
  parseCapacity,
  parseDayList,
  parseIsoDate,
  parseModality,
  parseMonth,
  parseTime,
  weekStartMonday,
  CLASS_DAYS,
} from '../classRules.js'
import { draftWorkout } from '../workoutAssist.js'
import { weekdayId } from '../dailySummary.js'
import {
  formatBrazilPhone,
  normalizePhone,
  normalizeUsername,
  studentAccessUrl,
  newStudentPassword,
  studentLoginEmail,
  welcomeMessage,
} from '../studentAccount.js'
import { sendWhatsAppText } from '../whatsappSessions.js'
import { brazilMonth, brazilNowTime, brazilToday } from '../dates.js'
import { requireDb } from '../db.js'

const DAY_ORDER = new Map(CLASS_DAYS.map((day, index) => [day, index]))

function wrap(handler) {
  return async (req, res) => {
    try {
      await handler(req, res)
    } catch (err) {
      console.error(err)
      if (!res.headersSent) {
        res.status(500).json({ error: 'Falha ao processar' })
      }
    }
  }
}

function professorIdOf(req, res) {
  const id = req.user?.id
  if (typeof id !== 'string' || !id) {
    res.status(401).json({ error: 'Não autenticado' })
    return null
  }
  return id
}

function studioIdOf(req, res) {
  const id = req.user?.professorId
  if (typeof id !== 'string' || !id) {
    res.status(403).json({ error: 'Acesso só do aluno' })
    return null
  }
  return id
}

function parseId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function confirmed(value) {
  return value === true || value === '1' || value === 'true'
}

function isUnique(error) {
  return error?.code === '23505' || /duplicate|unique/i.test(error?.message ?? '')
}

function mapStudent(row) {
  const legacyEmail =
    row.username || !row.email || String(row.email).endsWith('@alunos.sante.invalid')
      ? ''
      : row.email
  return {
    id: Number(row.id),
    name: row.name,
    username: row.username || legacyEmail,
    phone: row.phone ? formatBrazilPhone(row.phone) : '',
    crossfit: Boolean(row.crossfit),
    hyrox: Boolean(row.hyrox),
  }
}

async function deliverWelcome(userId, { name, username, phone, password }) {
  try {
    await sendWhatsAppText(
      userId,
      phone,
      welcomeMessage({
        name,
        username,
        password,
        url: studentAccessUrl(),
      }),
    )
    return { whatsappSent: true, whatsappError: null }
  } catch (err) {
    const whatsappError = err instanceof Error ? err.message : 'Falha ao enviar mensagem'
    console.error('boas-vindas do aluno', whatsappError)
    return { whatsappSent: false, whatsappError }
  }
}

function mapSlot(row) {
  return {
    id: Number(row.id),
    modality: row.modality,
    day: row.day,
    time: String(row.time).slice(0, 5),
    capacity: Number(row.capacity),
  }
}

function sortByDayTime(slots) {
  return [...slots].sort((a, b) => {
    const day = (DAY_ORDER.get(a.day) ?? 0) - (DAY_ORDER.get(b.day) ?? 0)
    if (day !== 0) return day
    return a.time < b.time ? -1 : a.time > b.time ? 1 : 0
  })
}

async function loadStudentByAuth(db, authUserId) {
  const { data, error } = await db
    .from('class_students')
    .select('id, user_id, name, email, crossfit, hyrox')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  return { student: data, error }
}

async function futureRows(db, userId, filter, today) {
  let query = db
    .from('class_checkins')
    .select('id, class_on, time')
    .eq('user_id', userId)
    .gte('class_on', today)
  if (filter.slotId) query = query.eq('slot_id', filter.slotId)
  if (filter.modality) query = query.eq('modality', filter.modality)
  if (filter.day) query = query.eq('day', filter.day)
  const { data, error } = await query
  if (error) return { rows: null, error }
  return { rows: data ?? [], error: null }
}

function futureIds(rows, today, nowTime) {
  return rows
    .filter((row) =>
      isFutureCheckin({
        today,
        nowTime,
        classDate: String(row.class_on).slice(0, 10),
        classTime: row.time,
      }),
    )
    .map((row) => row.id)
}

async function deleteCheckins(db, ids) {
  if (ids.length === 0) return { error: null }
  const { error } = await db.from('class_checkins').delete().in('id', ids)
  return { error }
}

async function countFuture(db, userId, filter, today, nowTime) {
  const { rows, error } = await futureRows(db, userId, filter, today)
  if (error) return { count: 0, ids: [], error }
  const ids = futureIds(rows, today, nowTime)
  return { count: ids.length, ids, error: null }
}

function needsConfirm(res, count, target) {
  res.status(409).json({
    error: futureCheckinMessage(count, target),
    needsConfirm: true,
    futureCount: count,
  })
}

function projectRef() {
  try {
    return new URL(process.env.SUPABASE_URL ?? '').host.split('.')[0]
  } catch {
    return ''
  }
}

function failDb(res, error, fallback) {
  console.error(error)
  const message = error?.message ?? ''
  if (error?.code === 'PGRST205' || /schema cache|Could not find the table/i.test(message)) {
    const ref = projectRef()
    res.status(500).json({
      error: ref
        ? `A API do Supabase do projeto ${ref} não publica as tabelas de turma. ${message}`
        : message || fallback,
    })
    return
  }
  res.status(500).json({ error: message || fallback })
}

function parseModalities(body) {
  if (typeof body?.crossfit !== 'boolean' || typeof body?.hyrox !== 'boolean') return null
  if (!body.crossfit && !body.hyrox) return null
  return { crossfit: body.crossfit, hyrox: body.hyrox }
}

const professor = Router()
professor.use((req, res, next) => {
  if (req.user?.role !== 'student') {
    next()
    return
  }
  const path = req.path
  if (path === '/week' || path === '/attendance' || path.startsWith('/checkins')) {
    next('router')
    return
  }
  requireProfessor(req, res, next)
})

professor.get(
  '/students',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const userId = professorIdOf(req, res)
    if (!db || !userId) return
    const { data, error } = await db
      .from('class_students')
      .select('id, name, username, phone, email, crossfit, hyrox')
      .eq('user_id', userId)
      .order('name')
    if (error) {
      failDb(res, error, 'Falha ao listar alunos')
      return
    }
    res.json((data ?? []).map(mapStudent))
  }),
)

professor.post(
  '/students',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const userId = professorIdOf(req, res)
    if (!db || !userId) return

    const name = String(req.body?.name ?? '').trim()
    const username = normalizeUsername(req.body?.username)
    const phone = normalizePhone(req.body?.phone)
    const password = String(req.body?.password ?? '')
    const modalities = parseModalities(req.body)
    if (!name || name.length > 80) {
      res.status(400).json({ error: 'Nome inválido' })
      return
    }
    if (!modalities) {
      res.status(400).json({ error: 'Marque Crossfit, Hyrox ou os dois' })
      return
    }
    if (!username) {
      res.status(400).json({
        error: 'Usuário inválido. Use de 3 a 30 caracteres: letras, números, ponto, _ ou -.',
      })
      return
    }
    if (!phone) {
      res.status(400).json({ error: 'Celular inválido' })
      return
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres' })
      return
    }

    const email = studentLoginEmail(username)
    const created = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'student', professor_id: userId },
    })
    if (created.error || !created.data.user) {
      const message = created.error?.message ?? ''
      if (/already been registered|already exists/i.test(message)) {
        res.status(409).json({ error: 'Usuário já cadastrado' })
        return
      }
      console.error(created.error)
      res.status(500).json({ error: 'Falha ao criar o aluno' })
      return
    }

    const authUserId = created.data.user.id
    const inserted = await db
      .from('class_students')
      .insert({
        user_id: userId,
        auth_user_id: authUserId,
        name,
        username,
        phone,
        email,
        crossfit: modalities.crossfit,
        hyrox: modalities.hyrox,
      })
      .select('id, name, username, phone, email, crossfit, hyrox')
      .single()
    if (inserted.error) {
      await db.auth.admin.deleteUser(authUserId)
      if (isUnique(inserted.error)) {
        res.status(409).json({ error: 'Usuário já cadastrado' })
        return
      }
      failDb(res, inserted.error, 'Falha ao criar o aluno')
      return
    }
    const student = mapStudent(inserted.data)
    const delivery = await deliverWelcome(userId, { name, username, phone, password })
    res.status(201).json({ ...student, ...delivery })
  }),
)

professor.post(
  '/students/:id/resend',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const userId = professorIdOf(req, res)
    const studentId = parseId(req.params.id)
    if (!db || !userId || !studentId) {
      if (!studentId) res.status(400).json({ error: 'Aluno inválido' })
      return
    }
    const { data, error } = await db
      .from('class_students')
      .select('auth_user_id, name, username, phone')
      .eq('id', studentId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      failDb(res, error, 'Falha ao reenviar o cadastro')
      return
    }
    if (!data?.auth_user_id) {
      res.status(404).json({ error: 'Aluno não encontrado' })
      return
    }
    if (!data.username) {
      res.status(400).json({ error: 'Esse aluno não tem usuário' })
      return
    }
    if (!data.phone) {
      res.status(400).json({ error: 'Esse aluno não tem celular' })
      return
    }
    const password = newStudentPassword()
    const updated = await db.auth.admin.updateUserById(data.auth_user_id, { password })
    if (updated.error) {
      console.error(updated.error)
      res.status(500).json({ error: 'Falha ao reenviar o cadastro' })
      return
    }
    const delivery = await deliverWelcome(userId, {
      name: data.name,
      username: data.username,
      phone: data.phone,
      password,
    })
    res.json({
      ...delivery,
      password: delivery.whatsappSent ? null : password,
    })
  }),
)

professor.patch(
  '/students/:id',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const userId = professorIdOf(req, res)
    const studentId = parseId(req.params.id)
    if (!db || !userId) return
    if (!studentId) {
      res.status(400).json({ error: 'Aluno inválido' })
      return
    }
    const patch = {}
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim()
      if (!name || name.length > 80) {
        res.status(400).json({ error: 'Nome inválido' })
        return
      }
      patch.name = name
    }
    if (req.body?.phone !== undefined) {
      const phone = normalizePhone(req.body.phone)
      if (!phone) {
        res.status(400).json({ error: 'Celular inválido' })
        return
      }
      patch.phone = phone
    }
    if (req.body?.crossfit !== undefined || req.body?.hyrox !== undefined) {
      const modalities = parseModalities(req.body)
      if (!modalities) {
        res.status(400).json({ error: 'Marque Crossfit, Hyrox ou os dois' })
        return
      }
      Object.assign(patch, modalities)
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: 'Nada para salvar' })
      return
    }
    const updated = await db
      .from('class_students')
      .update(patch)
      .eq('id', studentId)
      .eq('user_id', userId)
      .select('id, name, username, phone, email, crossfit, hyrox')
      .maybeSingle()
    if (updated.error) {
      failDb(res, updated.error, 'Falha ao salvar o aluno')
      return
    }
    if (!updated.data) {
      res.status(404).json({ error: 'Aluno não encontrado' })
      return
    }
    res.json(mapStudent(updated.data))
  }),
)

professor.delete(
  '/students/:id',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const userId = professorIdOf(req, res)
    const studentId = parseId(req.params.id)
    if (!db || !userId || !studentId) {
      if (!studentId) res.status(400).json({ error: 'Aluno inválido' })
      return
    }
    const { data, error } = await db
      .from('class_students')
      .select('auth_user_id')
      .eq('id', studentId)
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      console.error(error)
      res.status(500).json({ error: 'Falha ao remover o aluno' })
      return
    }
    if (!data) {
      res.status(404).json({ error: 'Aluno não encontrado' })
      return
    }
    if (data.auth_user_id) {
      const removed = await db.auth.admin.deleteUser(data.auth_user_id)
      if (removed.error && !/not found/i.test(removed.error.message)) {
        console.error(removed.error)
        res.status(500).json({ error: 'Falha ao remover o aluno' })
        return
      }
    }
    const deleted = await db
      .from('class_students')
      .delete()
      .eq('id', studentId)
      .eq('user_id', userId)
    if (deleted.error) {
      console.error(deleted.error)
      res.status(500).json({ error: 'Falha ao remover o aluno' })
      return
    }
    res.status(204).end()
  }),
)

professor.get(
  '/schedule',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const userId = professorIdOf(req, res)
    const modality = parseModality(req.query.modality)
    if (!db || !userId) return
    if (!modality) {
      res.status(400).json({ error: 'Modalidade inválida' })
      return
    }
    const [daysResult, slotsResult] = await Promise.all([
      db.from('class_days').select('day').eq('user_id', userId).eq('modality', modality),
      db
        .from('class_slots')
        .select('id, modality, day, time, capacity')
        .eq('user_id', userId)
        .eq('modality', modality),
    ])
    if (daysResult.error || slotsResult.error) {
      console.error(daysResult.error ?? slotsResult.error)
      res.status(500).json({ error: 'Falha ao carregar os horários' })
      return
    }
    const days = (daysResult.data ?? [])
      .map((row) => row.day)
      .sort((a, b) => (DAY_ORDER.get(a) ?? 0) - (DAY_ORDER.get(b) ?? 0))
    res.json({
      modality,
      days,
      slots: sortByDayTime((slotsResult.data ?? []).map(mapSlot)),
    })
  }),
)

professor.put(
  '/days',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const userId = professorIdOf(req, res)
    const modality = parseModality(req.body?.modality)
    const days = parseDayList(req.body?.days)
    if (!db || !userId) return
    if (!modality || !days) {
      res.status(400).json({ error: 'Dias inválidos' })
      return
    }

    const current = await db
      .from('class_days')
      .select('day')
      .eq('user_id', userId)
      .eq('modality', modality)
    if (current.error) {
      console.error(current.error)
      res.status(500).json({ error: 'Falha ao salvar os dias' })
      return
    }
    const currentDays = new Set((current.data ?? []).map((row) => row.day))
    const nextDays = new Set(days)
    const removed = [...currentDays].filter((day) => !nextDays.has(day))
    const added = days.filter((day) => !currentDays.has(day))
    const today = brazilToday()
    const nowTime = brazilNowTime()

    let pendingIds = []
    for (const day of removed) {
      const pending = await countFuture(
        db,
        userId,
        { modality, day },
        today,
        nowTime,
      )
      if (pending.error) {
        console.error(pending.error)
        res.status(500).json({ error: 'Falha ao salvar os dias' })
        return
      }
      pendingIds = pendingIds.concat(pending.ids)
    }
    if (pendingIds.length > 0 && !confirmed(req.body?.confirm)) {
      needsConfirm(res, pendingIds.length, 'nesse dia')
      return
    }

    const removedCheckins = await deleteCheckins(db, pendingIds)
    if (removedCheckins.error) {
      console.error(removedCheckins.error)
      res.status(500).json({ error: 'Falha ao salvar os dias' })
      return
    }
    if (removed.length > 0) {
      const deletedSlots = await db
        .from('class_slots')
        .delete()
        .eq('user_id', userId)
        .eq('modality', modality)
        .in('day', removed)
      if (deletedSlots.error) {
        console.error(deletedSlots.error)
        res.status(500).json({ error: 'Falha ao salvar os dias' })
        return
      }
      const deletedDays = await db
        .from('class_days')
        .delete()
        .eq('user_id', userId)
        .eq('modality', modality)
        .in('day', removed)
      if (deletedDays.error) {
        console.error(deletedDays.error)
        res.status(500).json({ error: 'Falha ao salvar os dias' })
        return
      }
    }
    if (added.length > 0) {
      const inserted = await db.from('class_days').insert(
        added.map((day) => ({ user_id: userId, modality, day })),
      )
      if (inserted.error) {
        console.error(inserted.error)
        res.status(500).json({ error: 'Falha ao salvar os dias' })
        return
      }
    }
    res.json({ modality, days })
  }),
)

professor.post(
  '/slots',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const userId = professorIdOf(req, res)
    const modality = parseModality(req.body?.modality)
    const day = parseDayList([req.body?.day])?.[0] ?? null
    const time = parseTime(req.body?.time)
    const capacity = parseCapacity(req.body?.capacity)
    if (!db || !userId) return
    if (!modality || !day || !time || !capacity) {
      res.status(400).json({ error: 'Horário inválido' })
      return
    }
    const enabled = await db.from('class_days').upsert(
      { user_id: userId, modality, day },
      { onConflict: 'user_id,modality,day', ignoreDuplicates: true },
    )
    if (enabled.error) {
      failDb(res, enabled.error, 'Falha ao criar o horário')
      return
    }
    const inserted = await db
      .from('class_slots')
      .insert({ user_id: userId, modality, day, time, capacity })
      .select('id, modality, day, time, capacity')
      .single()
    if (inserted.error) {
      if (isUnique(inserted.error)) {
        res.status(409).json({ error: 'Esse horário já existe nesse dia' })
        return
      }
      console.error(inserted.error)
      res.status(500).json({ error: 'Falha ao criar o horário' })
      return
    }
    res.status(201).json(mapSlot(inserted.data))
  }),
)

professor.patch(
  '/slots/:id',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const userId = professorIdOf(req, res)
    const slotId = parseId(req.params.id)
    const capacity = parseCapacity(req.body?.capacity)
    const time = parseTime(req.body?.time)
    if (!db || !userId || !slotId || !capacity || !time) {
      if (!res.headersSent) res.status(400).json({ error: 'Horário inválido' })
      return
    }
    const current = await db
      .from('class_slots')
      .select('id, time')
      .eq('id', slotId)
      .eq('user_id', userId)
      .maybeSingle()
    if (current.error) {
      failDb(res, current.error, 'Falha ao salvar o horário')
      return
    }
    if (!current.data) {
      res.status(404).json({ error: 'Horário não encontrado' })
      return
    }
    const updated = await db
      .from('class_slots')
      .update({ capacity, time })
      .eq('id', slotId)
      .eq('user_id', userId)
      .select('id, modality, day, time, capacity')
      .maybeSingle()
    if (updated.error) {
      if (isUnique(updated.error)) {
        res.status(409).json({ error: 'Esse horário já existe nesse dia' })
        return
      }
      failDb(res, updated.error, 'Falha ao salvar o horário')
      return
    }
    if (time !== current.data.time) {
      const today = brazilToday()
      const nowTime = brazilNowTime()
      const pending = await countFuture(db, userId, { slotId }, today, nowTime)
      if (pending.error) {
        failDb(res, pending.error, 'Falha ao salvar o horário')
        return
      }
      if (pending.ids.length > 0) {
        const moved = await db
          .from('class_checkins')
          .update({ time })
          .in('id', pending.ids)
        if (moved.error) {
          failDb(res, moved.error, 'Falha ao salvar o horário')
          return
        }
      }
    }
    res.json(mapSlot(updated.data))
  }),
)

professor.delete(
  '/slots/:id',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const userId = professorIdOf(req, res)
    const slotId = parseId(req.params.id)
    if (!db || !userId || !slotId) {
      if (!slotId && !res.headersSent) res.status(400).json({ error: 'Horário inválido' })
      return
    }
    const slot = await db
      .from('class_slots')
      .select('id, modality, day')
      .eq('id', slotId)
      .eq('user_id', userId)
      .maybeSingle()
    if (slot.error) {
      console.error(slot.error)
      res.status(500).json({ error: 'Falha ao apagar o horário' })
      return
    }
    if (!slot.data) {
      res.status(404).json({ error: 'Horário não encontrado' })
      return
    }
    const today = brazilToday()
    const nowTime = brazilNowTime()
    const pending = await countFuture(db, userId, { slotId }, today, nowTime)
    if (pending.error) {
      console.error(pending.error)
      res.status(500).json({ error: 'Falha ao apagar o horário' })
      return
    }
    if (pending.count > 0 && !confirmed(req.query.confirm)) {
      needsConfirm(res, pending.count, 'nesse horário')
      return
    }
    const removed = await deleteCheckins(db, pending.ids)
    if (removed.error) {
      console.error(removed.error)
      res.status(500).json({ error: 'Falha ao apagar o horário' })
      return
    }
    const deleted = await db.from('class_slots').delete().eq('id', slotId).eq('user_id', userId)
    if (deleted.error) {
      console.error(deleted.error)
      res.status(500).json({ error: 'Falha ao apagar o horário' })
      return
    }
    const remaining = await db
      .from('class_slots')
      .select('id')
      .eq('user_id', userId)
      .eq('modality', slot.data.modality)
      .eq('day', slot.data.day)
    if (remaining.error) {
      console.error(remaining.error)
      res.status(500).json({ error: 'Falha ao apagar o horário' })
      return
    }
    if ((remaining.data ?? []).length === 0) {
      const dayOff = await db
        .from('class_days')
        .delete()
        .eq('user_id', userId)
        .eq('modality', slot.data.modality)
        .eq('day', slot.data.day)
      if (dayOff.error) {
        console.error(dayOff.error)
        res.status(500).json({ error: 'Falha ao apagar o horário' })
        return
      }
    }
    res.status(204).end()
  }),
)

professor.get(
  '/workouts',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const userId = professorIdOf(req, res)
    const modality = parseModality(req.query.modality)
    const from = parseIsoDate(req.query.week) ?? brazilToday()
    if (!db || !userId) return
    if (!modality || !from) {
      res.status(400).json({ error: 'Semana inválida' })
      return
    }
    const weekStart = weekStartMonday(from)
    const weekEnd = dateForWeekday(weekStart, 'dom')
    const workoutsResult = await db
      .from('class_workouts')
      .select('workout_on, body')
      .eq('user_id', userId)
      .eq('modality', modality)
      .gte('workout_on', weekStart)
      .lte('workout_on', weekEnd)
    if (workoutsResult.error) {
      failDb(res, workoutsResult.error, 'Falha ao carregar os treinos')
      return
    }
    const byDate = new Map(
      (workoutsResult.data ?? []).map((row) => [String(row.workout_on).slice(0, 10), row.body ?? '']),
    )
    res.json({
      modality,
      weekStart,
      days: CLASS_DAYS.map((day) => {
        const date = dateForWeekday(weekStart, day)
        return { day, date, body: byDate.get(date) ?? '' }
      }),
    })
  }),
)

professor.put(
  '/workouts',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const userId = professorIdOf(req, res)
    const modality = parseModality(req.body?.modality)
    const date = parseIsoDate(req.body?.date)
    const body = typeof req.body?.body === 'string' ? req.body.body : null
    if (!db || !userId) return
    if (!modality || !date || body === null || body.length > 8000) {
      res.status(400).json({ error: 'Treino inválido' })
      return
    }
    const saved = await db
      .from('class_workouts')
      .upsert(
        { user_id: userId, modality, workout_on: date, body },
        { onConflict: 'user_id,modality,workout_on' },
      )
      .select('workout_on, body')
      .single()
    if (saved.error) {
      console.error(saved.error)
      res.status(500).json({ error: 'Falha ao salvar o treino' })
      return
    }
    res.json({
      modality,
      date: String(saved.data.workout_on).slice(0, 10),
      body: saved.data.body ?? '',
    })
  }),
)

professor.post(
  '/workouts/assist',
  wrap(async (req, res) => {
    const userId = professorIdOf(req, res)
    if (!userId) return
    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt.trim() : ''
    if (!prompt || prompt.length > 2000) {
      res.status(400).json({ error: 'Pedido inválido' })
      return
    }
    try {
      const text = await draftWorkout(prompt)
      res.json({ text })
    } catch (err) {
      const status = err.status ?? 500
      res.status(status).json({ error: err.message || 'Falha ao gerar o treino' })
    }
  }),
)

professor.get(
  '/week',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const userId = professorIdOf(req, res)
    if (!db || !userId) return
    const from = req.query.from ? parseIsoDate(req.query.from) : brazilToday()
    if (!from) {
      res.status(400).json({ error: 'Semana inválida' })
      return
    }
    const week = await buildWeek(db, userId, from, {
      id: 0,
      crossfit: true,
      hyrox: true,
    })
    if (week.error) {
      console.error(week.error)
      res.status(500).json({ error: 'Falha ao carregar a semana' })
      return
    }
    res.json(week.body)
  }),
)

professor.get(
  '/attendance',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const userId = professorIdOf(req, res)
    const month = parseMonth(req.query.month) ?? brazilMonth()
    if (!db || !userId) return
    if (!month) {
      res.status(400).json({ error: 'Mês inválido' })
      return
    }
    const { rows, error } = await attendanceRows(db, userId, month)
    if (error) {
      console.error(error)
      res.status(500).json({ error: 'Falha ao carregar o comparecimento' })
      return
    }
    const students = await db
      .from('class_students')
      .select('id, name')
      .eq('user_id', userId)
      .order('name')
    if (students.error) {
      console.error(students.error)
      res.status(500).json({ error: 'Falha ao carregar o comparecimento' })
      return
    }
    res.json({ month, scope: 'studio', rows: groupAttendance(students.data ?? [], rows) })
  }),
)

const student = Router()
student.use(requireStudent)

student.get(
  '/week',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const studioId = studioIdOf(req, res)
    if (!db || !studioId) return
    const from = req.query.from ? parseIsoDate(req.query.from) : brazilToday()
    if (!from) {
      res.status(400).json({ error: 'Semana inválida' })
      return
    }
    const found = await loadStudentByAuth(db, req.user.id)
    if (found.error) {
      console.error(found.error)
      res.status(500).json({ error: 'Falha ao carregar a semana' })
      return
    }
    if (!found.student || found.student.user_id !== studioId) {
      res.status(403).json({ error: 'Aluno não encontrado' })
      return
    }
    const week = await buildWeek(db, studioId, from, found.student)
    if (week.error) {
      console.error(week.error)
      res.status(500).json({ error: 'Falha ao carregar a semana' })
      return
    }
    res.json(week.body)
  }),
)

student.post(
  '/checkins',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const studioId = studioIdOf(req, res)
    const slotId = parseId(req.body?.slotId)
    const date = parseIsoDate(req.body?.date)
    if (!db || !studioId) return
    if (!slotId || !date) {
      res.status(400).json({ error: 'Check-in inválido' })
      return
    }
    const found = await loadStudentByAuth(db, req.user.id)
    if (found.error) {
      console.error(found.error)
      res.status(500).json({ error: 'Falha ao fazer check-in' })
      return
    }
    if (!found.student || found.student.user_id !== studioId) {
      res.status(403).json({ error: 'Aluno não encontrado' })
      return
    }
    const slot = await db
      .from('class_slots')
      .select('id, modality, day, time, capacity, user_id')
      .eq('id', slotId)
      .eq('user_id', studioId)
      .maybeSingle()
    if (slot.error) {
      console.error(slot.error)
      res.status(500).json({ error: 'Falha ao fazer check-in' })
      return
    }
    if (!slot.data) {
      res.status(404).json({ error: 'Horário não encontrado' })
      return
    }
    if (slot.data.modality === 'crossfit' && !found.student.crossfit) {
      res.status(403).json({ error: 'Você não está no Crossfit' })
      return
    }
    if (slot.data.modality === 'hyrox' && !found.student.hyrox) {
      res.status(403).json({ error: 'Você não está no Hyrox' })
      return
    }
    if (weekdayId(date) !== slot.data.day) {
      res.status(400).json({ error: 'Esse horário não acontece nessa data' })
      return
    }
    const enabled = await db
      .from('class_days')
      .select('day')
      .eq('user_id', studioId)
      .eq('modality', slot.data.modality)
      .eq('day', slot.data.day)
      .maybeSingle()
    if (enabled.error) {
      console.error(enabled.error)
      res.status(500).json({ error: 'Falha ao fazer check-in' })
      return
    }
    if (!enabled.data) {
      res.status(400).json({ error: 'Esse dia não está na grade' })
      return
    }

    const today = brazilToday()
    const nowTime = brazilNowTime()
    const takenResult = await db
      .from('class_checkins')
      .select('id, student_id')
      .eq('slot_id', slotId)
      .eq('class_on', date)
    if (takenResult.error) {
      console.error(takenResult.error)
      res.status(500).json({ error: 'Falha ao fazer check-in' })
      return
    }
    const takenRows = takenResult.data ?? []
    const decision = checkinDecision({
      today,
      nowTime,
      classDate: date,
      classTime: slot.data.time,
      taken: takenRows.length,
      capacity: Number(slot.data.capacity),
      alreadyIn: takenRows.some((row) => Number(row.student_id) === Number(found.student.id)),
    })
    if (!decision.ok) {
      res.status(409).json({ error: checkinError(decision.reason) })
      return
    }

    const inserted = await db
      .from('class_checkins')
      .insert({
        user_id: studioId,
        student_id: found.student.id,
        slot_id: slot.data.id,
        student_name: found.student.name,
        modality: slot.data.modality,
        day: slot.data.day,
        time: slot.data.time,
        class_on: date,
      })
      .select('id')
      .single()
    if (inserted.error) {
      if (isUnique(inserted.error)) {
        res.status(409).json({ error: checkinError('duplicate') })
        return
      }
      console.error(inserted.error)
      res.status(500).json({ error: 'Falha ao fazer check-in' })
      return
    }
    res.status(201).json({ id: Number(inserted.data.id) })
  }),
)

student.delete(
  '/checkins/:id',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const studioId = studioIdOf(req, res)
    const checkinId = parseId(req.params.id)
    if (!db || !studioId || !checkinId) {
      if (!checkinId && !res.headersSent) res.status(400).json({ error: 'Check-in inválido' })
      return
    }
    const found = await loadStudentByAuth(db, req.user.id)
    if (found.error) {
      console.error(found.error)
      res.status(500).json({ error: 'Falha ao cancelar o check-in' })
      return
    }
    if (!found.student) {
      res.status(403).json({ error: 'Aluno não encontrado' })
      return
    }
    const row = await db
      .from('class_checkins')
      .select('id, student_id, class_on, time')
      .eq('id', checkinId)
      .eq('user_id', studioId)
      .maybeSingle()
    if (row.error) {
      console.error(row.error)
      res.status(500).json({ error: 'Falha ao cancelar o check-in' })
      return
    }
    if (!row.data || Number(row.data.student_id) !== Number(found.student.id)) {
      res.status(404).json({ error: 'Check-in não encontrado' })
      return
    }
    const window = checkinWindow({
      today: brazilToday(),
      nowTime: brazilNowTime(),
      classDate: String(row.data.class_on).slice(0, 10),
      classTime: row.data.time,
    })
    if (!window.ok) {
      res.status(409).json({ error: checkinError(window.reason) })
      return
    }
    const deleted = await db
      .from('class_checkins')
      .delete()
      .eq('id', checkinId)
      .eq('student_id', found.student.id)
    if (deleted.error) {
      console.error(deleted.error)
      res.status(500).json({ error: 'Falha ao cancelar o check-in' })
      return
    }
    res.status(204).end()
  }),
)

student.get(
  '/attendance',
  wrap(async (req, res) => {
    const db = requireDb(res)
    const studioId = studioIdOf(req, res)
    const month = parseMonth(req.query.month) ?? brazilToday().slice(0, 7)
    if (!db || !studioId) return
    if (!month) {
      res.status(400).json({ error: 'Mês inválido' })
      return
    }
    const found = await loadStudentByAuth(db, req.user.id)
    if (found.error) {
      console.error(found.error)
      res.status(500).json({ error: 'Falha ao carregar o mês' })
      return
    }
    if (!found.student || found.student.user_id !== studioId) {
      res.status(403).json({ error: 'Aluno não encontrado' })
      return
    }
    const { rows, error } = await attendanceRows(db, studioId, month, found.student.id)
    if (error) {
      console.error(error)
      res.status(500).json({ error: 'Falha ao carregar o mês' })
      return
    }
    const sessions = rows.map(mapSession)
    res.json({
      month,
      scope: 'mine',
      name: found.student.name,
      crossfit: sessions.filter((item) => item.modality === 'crossfit').length,
      hyrox: sessions.filter((item) => item.modality === 'hyrox').length,
      sessions,
    })
  }),
)

function checkinError(reason) {
  if (reason === 'full') return 'Horário lotado'
  if (reason === 'duplicate') return 'Você já está neste horário'
  if (reason === 'past' || reason === 'started') return 'Esse horário já passou'
  return 'Check-in só até a semana que vem'
}

function mapSession(row) {
  return {
    date: String(row.class_on).slice(0, 10),
    time: row.time,
    modality: row.modality,
    studentName: row.student_name,
  }
}

async function attendanceRows(db, userId, month, studentId) {
  const start = `${month}-01`
  const end = nextMonthStart(month)
  let query = db
    .from('class_checkins')
    .select('student_id, student_name, modality, time, class_on')
    .eq('user_id', userId)
    .gte('class_on', start)
    .lt('class_on', end)
  if (studentId) query = query.eq('student_id', studentId)
  const { data, error } = await query
  return { rows: data ?? [], error }
}

function groupAttendance(students, rows) {
  const groups = new Map()
  for (const studentRow of students) {
    groups.set(`id:${studentRow.id}`, {
      key: `id:${studentRow.id}`,
      studentId: Number(studentRow.id),
      name: studentRow.name,
      crossfit: 0,
      hyrox: 0,
      sessions: [],
    })
  }
  for (const row of rows) {
    const key = row.student_id ? `id:${row.student_id}` : `name:${row.student_name}`
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        studentId: null,
        name: row.student_name,
        crossfit: 0,
        hyrox: 0,
        sessions: [],
      })
    }
    const group = groups.get(key)
    if (row.modality === 'hyrox') group.hyrox += 1
    else group.crossfit += 1
    group.sessions.push(mapSession(row))
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      sessions: group.sessions.sort((a, b) =>
        a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
      ),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}

async function buildWeek(db, studioId, from, student) {
  const today = brazilToday()
  const nowTime = brazilNowTime()
  const weekStart = weekStartMonday(from)
  const weekEnd = dateForWeekday(weekStart, 'dom')
  const [daysResult, slotsResult, workoutsResult, checkinsResult] = await Promise.all([
    db.from('class_days').select('modality, day').eq('user_id', studioId),
    db
      .from('class_slots')
      .select('id, modality, day, time, capacity')
      .eq('user_id', studioId),
    db
      .from('class_workouts')
      .select('modality, workout_on, body')
      .eq('user_id', studioId)
      .gte('workout_on', weekStart)
      .lte('workout_on', weekEnd),
    db
      .from('class_checkins')
      .select('id, slot_id, student_id, student_name, class_on')
      .eq('user_id', studioId)
      .gte('class_on', weekStart)
      .lte('class_on', weekEnd),
  ])
  const error = daysResult.error || slotsResult.error || workoutsResult.error || checkinsResult.error
  if (error) return { error }

  const workoutKey = (modality, date) => `${modality}:${date}`
  const workouts = new Map(
    (workoutsResult.data ?? []).map((row) => [
      workoutKey(row.modality, String(row.workout_on).slice(0, 10)),
      row.body ?? '',
    ]),
  )
  const checkinsBySlotDate = new Map()
  for (const row of checkinsResult.data ?? []) {
    const date = String(row.class_on).slice(0, 10)
    const key = `${row.slot_id}:${date}`
    const list = checkinsBySlotDate.get(key) ?? []
    list.push(row)
    checkinsBySlotDate.set(key, list)
  }

  const allowed = []
  if (student.crossfit) allowed.push('crossfit')
  if (student.hyrox) allowed.push('hyrox')
  const modalities = {}
  for (const modality of allowed) {
    const scheduled = new Set(
      (daysResult.data ?? []).filter((row) => row.modality === modality).map((row) => row.day),
    )
    const days = CLASS_DAYS.filter((day) => {
      const date = dateForWeekday(weekStart, day)
      const hasWorkout = (workouts.get(workoutKey(modality, date)) ?? '').trim().length > 0
      return scheduled.has(day) || hasWorkout
    })
    modalities[modality] = {
      days: days.map((day) => {
        const date = dateForWeekday(weekStart, day)
        const slots = sortByDayTime(
          (slotsResult.data ?? [])
            .filter((row) => row.modality === modality && row.day === day)
            .map(mapSlot),
        ).map((slot) => {
          const people = (checkinsBySlotDate.get(`${slot.id}:${date}`) ?? [])
            .map((row) => ({
              id: Number(row.id),
              studentName: row.student_name,
              mine: Number(row.student_id) === Number(student.id),
            }))
            .sort((a, b) => a.studentName.localeCompare(b.studentName, 'pt-BR'))
          const mine = people.find((person) => person.mine) ?? null
          const window = checkinWindow({
            today,
            nowTime,
            classDate: date,
            classTime: slot.time,
          })
          return {
            ...slot,
            checkins: people,
            canJoin: window.ok && !mine && people.length < slot.capacity,
            canLeave: window.ok && Boolean(mine),
            myCheckinId: mine?.id ?? null,
            closedReason: window.ok ? null : window.reason,
          }
        })
        return {
          date,
          day,
          workout: workouts.get(workoutKey(modality, date)) ?? '',
          slots,
        }
      }),
    }
  }

  return {
    error: null,
    body: { weekStart, today, nowTime, modalities },
  }
}

export const classRouter = Router()
classRouter.use(professor)
classRouter.use(student)
