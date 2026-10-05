import { Router } from 'express'
import { requireDb } from '../db.js'
import { isValidWhatsAppPhone } from '../phone.js'

export const professorRouter = Router()

function ownerId(req, res) {
  const id = req.user?.id
  if (typeof id !== 'string' || !id) {
    res.status(401).json({ error: 'Não autenticado' })
    return null
  }
  return id
}

function toProfile(row) {
  return {
    name: row?.name ?? '',
    phone: row?.whatsapp_phone ?? '',
  }
}

professorRouter.get('/professor', async (req, res) => {
  const db = requireDb(res)
  if (!db) return
  const userId = ownerId(req, res)
  if (!userId) return

  const { data, error } = await db
    .from('professor_settings')
    .select('name, whatsapp_phone')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('GET /professor', error)
    res.status(500).json({ error: error.message })
    return
  }

  res.json(toProfile(data))
})

professorRouter.put('/professor', async (req, res) => {
  const db = requireDb(res)
  if (!db) return
  const userId = ownerId(req, res)
  if (!userId) return

  const name = String(req.body?.name ?? '').trim()
  const phone = String(req.body?.phone ?? '').trim()

  if (phone && !isValidWhatsAppPhone(phone)) {
    res.status(400).json({
      error: 'Telefone incompleto — use DDD + número (10 ou 11 dígitos)',
    })
    return
  }

  const { data, error } = await db
    .from('professor_settings')
    .upsert(
      { user_id: userId, name, whatsapp_phone: phone },
      { onConflict: 'user_id' },
    )
    .select('name, whatsapp_phone')
    .single()

  if (error) {
    console.error('PUT /professor', error)
    res.status(500).json({ error: error.message })
    return
  }

  res.json(toProfile(data))
})
