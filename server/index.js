import './loadEnv.js'
import cors from 'cors'
import express from 'express'
import { login, me, requireAuth } from './auth.js'
import { supabase } from './db.js'
import { runDailySummaries } from './dailySummary.js'
import { dataRouter } from './routes/data.js'
import { professorRouter } from './routes/professor.js'
import { isValidWhatsAppPhone } from './phone.js'
import {
  getWhatsAppStatus,
  isUserConnected,
  logoutWhatsApp,
  restoreSavedSessions,
  sendWhatsAppText,
  startWhatsApp,
} from './whatsappSessions.js'

const PORT = Number(process.env.PORT) || 3002

const app = express()
// O status do WhatsApp se repete o tempo todo. Com ETag, o navegador recebe
// 304 sem corpo e o front trata a conexão como falha.
app.set('etag', false)
app.use((_req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})
app.use(cors())
app.use(express.json())
app.post('/api/auth/login', login)
app.use('/api', requireAuth)
app.get('/api/auth/me', me)
app.use('/api', dataRouter)
app.use('/api', professorRouter)

function userId(req, res) {
  const id = req.user?.id
  if (!id) {
    res.status(401).json({ error: 'Não autenticado' })
    return null
  }
  return id
}

app.get('/api/whatsapp/status', (req, res) => {
  const id = userId(req, res)
  if (!id) return
  res.json(getWhatsAppStatus(id))
})

app.post('/api/whatsapp/start', async (req, res) => {
  const id = userId(req, res)
  if (!id) return
  try {
    await startWhatsApp(id)
    res.json({ ok: true, status: getWhatsAppStatus(id).status })
  } catch (err) {
    const status = err.status ?? 500
    res.status(status).json({ ok: false, error: err.message ?? 'Falha ao iniciar' })
  }
})

app.post('/api/whatsapp/logout', async (req, res) => {
  const id = userId(req, res)
  if (!id) return
  try {
    await logoutWhatsApp(id)
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(err.status ?? 500).json({ ok: false, error: 'Falha ao desconectar' })
  }
})

app.post('/api/whatsapp/send-one', async (req, res) => {
  const id = userId(req, res)
  if (!id) return

  const { phone, text } = req.body ?? {}
  if (!phone || !text) {
    res.status(400).json({ ok: false, error: 'Telefone e texto são obrigatórios' })
    return
  }
  if (!isValidWhatsAppPhone(phone)) {
    res.status(400).json({
      ok: false,
      error: 'Telefone incompleto — use DDD + número (10 ou 11 dígitos)',
    })
    return
  }

  try {
    await sendWhatsAppText(id, phone, text)
    res.json({ ok: true })
  } catch (err) {
    const status = err.status ?? 500
    res.status(status).json({
      ok: false,
      error: err instanceof Error ? err.message : 'Falha ao enviar mensagem',
    })
  }
})

async function sendSummaryForUser(userId, phone, text) {
  if (!isUserConnected(userId)) {
    console.log(`envio pulado user=${userId} — WhatsApp não conectado`)
    return false
  }
  await sendWhatsAppText(userId, phone, text)
  return true
}

function isLoopback(req) {
  const ip = req.socket?.remoteAddress ?? ''
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
}

app.post('/internal/send-summary', async (req, res) => {
  if (!isLoopback(req)) {
    res.status(404).end()
    return
  }

  const result = await runDailySummaries({
    db: supabase,
    sendForUser: sendSummaryForUser,
    force: true,
  })

  if (result.reason === 'busy') {
    res.status(409).json({ ok: false, error: 'Já existe um envio em andamento' })
    return
  }
  if (result.reason === 'error') {
    res.status(500).json({ ok: false, error: 'Falha ao enviar o resumo' })
    return
  }

  res.json({ ok: true, sent: result.sent ?? 0 })
})

async function tickDailySummary() {
  await runDailySummaries({
    db: supabase,
    sendForUser: sendSummaryForUser,
  })
}

const server = app.listen(PORT, () => {
  console.log(`WhatsApp server on http://localhost:${PORT}`)
  void restoreSavedSessions()
  void tickDailySummary()
  setInterval(() => void tickDailySummary(), 60_000)
})

server.on('error', (err) => {
  console.error('Failed to start server', err)
  process.exit(1)
})
