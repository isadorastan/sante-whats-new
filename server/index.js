import './loadEnv.js'
import cors from 'cors'
import express from 'express'
import qrcode from 'qrcode'
import pkg from 'whatsapp-web.js'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'
import { login, me, requireAuth } from './auth.js'
import { dataRouter } from './routes/data.js'

const { Client, LocalAuth } = pkg

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const AUTH_DIR = path.join(__dirname, '.wwebjs_auth')
const SESSION_DIR = path.join(AUTH_DIR, 'session')
const PORT = Number(process.env.PORT) || 3002
/** @type {'disconnected' | 'qr' | 'connected' | 'initializing'} */
let status = 'disconnected'
/** @type {string | null} */
let latestQr = null
/** @type {import('whatsapp-web.js').Client | null} */
let client = null
let starting = false

function toWhatsAppId(phone) {
  let digits = String(phone).replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)

  if (
    (digits.length === 12 || digits.length === 13) &&
    digits.startsWith('55')
  ) {
    return `${digits}@c.us`
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}@c.us`
  }

  return `${digits}@c.us`
}

function isValidWhatsAppDigits(digits) {
  return digits.length === 12 || digits.length === 13
}

function withTimeout(promise, ms, label) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} excedeu ${ms / 1000}s`))
    }, ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/** Fila: um envio por vez (evita travar o client do WhatsApp). */
let sendChain = Promise.resolve()
let recovering = false

function enqueueSend(task) {
  const run = sendChain.then(task, task)
  sendChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

function isDetachedError(err) {
  const msg = err instanceof Error ? err.message : String(err)
  return /detached Frame|Target closed|Session closed|Protocol error|Execution context was destroyed/i.test(
    msg,
  )
}

async function isPageAlive() {
  try {
    if (!client?.pupPage) return false
    const url = client.pupPage.url()
    if (!url || url === 'about:blank') return false
    if (!/web\.whatsapp\.com/i.test(url)) return false
    await withTimeout(client.pupPage.evaluate(() => true), 3000, 'Health check')
    return true
  } catch {
    return false
  }
}

async function recoverClient(reason) {
  if (recovering || starting) return
  recovering = true
  console.warn(`Recuperando client WhatsApp: ${reason}`)
  status = 'initializing'
  latestQr = null
  try {
    await createClient({ force: true })
  } finally {
    recovering = false
  }
}


function clearBrowserLocks() {
  for (const name of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
    try {
      fs.rmSync(path.join(SESSION_DIR, name), { force: true })
    } catch {
      // ignore
    }
  }

  try {
    execSync(`pkill -f ${JSON.stringify(SESSION_DIR)} || true`, {
      stdio: 'ignore',
    })
  } catch {
    // ignore
  }
}

/**
 * Mantém o WhatsApp Web estável; o envio real resolve LID via sync (sem salvar contato).
 */
async function applyLidWorkaround() {
  if (!client?.pupPage) return

  await client.pupPage.evaluate(() => {
    const inject = window.WWebJS?.injectToFunction
    if (!inject) return

    // Se toUserLid quebrar, devolve o wid original em vez de derrubar o envio
    inject(
      {
        module: 'WAWebLidMigrationUtils',
        function: 'toUserLid',
      },
      (module, orig, wid) => {
        try {
          return orig.call(module, wid)
        } catch {
          return wid
        }
      },
    )
  })

  console.log('LID helpers ready')
}

/**
 * Envia de verdade: sincroniza LID (sem salvar contato) e exige ID da mensagem.
 */
async function sendMessageSimple(phoneDigits, text) {
  if (!(await isPageAlive())) {
    throw new Error('detached Frame')
  }

  const result = await withTimeout(
    client.pupPage.evaluate(
      async (userId, message) => {
        const WidFactory = window.require('WAWebWidFactory')
        const FindOrCreate = window.require('WAWebFindChatAction')
        const ChatCollection = window.require('WAWebCollections').Chat
        const wid = WidFactory.createWid(userId)

        let exists
        try {
          exists = await window
            .require('WAWebQueryExistsJob')
            .queryWidExists(wid)
        } catch (e) {
          return {
            ok: false,
            error: e?.message || 'Falha ao verificar número no WhatsApp',
          }
        }

        if (!exists?.wid) {
          return { ok: false, error: 'Número sem WhatsApp' }
        }

        let lid = null
        try {
          lid = window.require('WAWebApiContact').getCurrentLid(wid)
        } catch {
          // ignore
        }

        // Resolve LID no servidor do WhatsApp (não salva na agenda do celular)
        if (!lid) {
          try {
            const query = window
              .require('WAWebContactSyncUtils')
              .constructUsyncDeltaQuery([
                { type: 'add', phoneNumber: wid.user },
              ])
            const syncResult = await query.execute()
            const lidValue = syncResult?.list?.[0]?.lid
            if (lidValue) lid = WidFactory.createWid(lidValue)
          } catch {
            // ignore
          }
        }

        const candidates = [lid, exists.wid, wid].filter(Boolean)
        let chat = null
        let lastError = null

        for (const candidate of candidates) {
          try {
            chat = ChatCollection.get(candidate)
            if (!chat) {
              chat = (
                await FindOrCreate.findOrCreateLatestChat(candidate).catch(
                  () => null,
                )
              )?.chat
            }
            if (chat) break
          } catch (e) {
            lastError = e
          }
        }

        if (!chat) {
          return {
            ok: false,
            error: lastError?.message || 'Não foi possível abrir o chat',
          }
        }

        try {
          // waitUntilMsgSent espera a confirmação do envio no WhatsApp
          const msg = await window.WWebJS.sendMessage(chat, message, {
            waitUntilMsgSent: true,
          })

          // Em algumas versões do WA Web o modelo ainda não está na collection,
          // mas a mensagem já foi enviada (sem throw = sucesso real).
          if (msg?.id) {
            return {
              ok: true,
              messageId: msg.id._serialized || String(msg.id),
              chatId: chat.id?._serialized || null,
              ack: typeof msg.ack === 'number' ? msg.ack : null,
            }
          }

          return {
            ok: true,
            messageId: null,
            chatId: chat.id?._serialized || null,
            ack: null,
          }
        } catch (e) {
          return { ok: false, error: e?.message || String(e) }
        }
      },
      `${phoneDigits}@c.us`,
      String(text),
    ),
    45000,
    'Envio WhatsApp',
  )

  if (!result?.ok) {
    throw new Error(result?.error || 'Falha ao enviar mensagem')
  }

  console.log(
    `mensagem confirmada id=${result.messageId} chat=${result.chatId} ack=${result.ack}`,
  )
  return result
}

async function destroyClient() {
  if (!client) return
  try {
    await client.destroy()
  } catch {
    // ignore
  }
  client = null
}

async function createClient({ force = false } = {}) {
  if (starting) return
  if (!force && client && status === 'connected') return

  starting = true
  status = 'initializing'
  latestQr = null

  await destroyClient()
  clearBrowserLocks()
  // dá tempo do Chrome soltar o userDataDir
  await new Promise((r) => setTimeout(r, 800))

  client = new Client({
    authStrategy: new LocalAuth({ dataPath: AUTH_DIR }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--mute-audio',
        '--no-first-run',
      ],
    },
  })

  client.on('qr', async (qr) => {
    status = 'qr'
    try {
      latestQr = await qrcode.toDataURL(qr)
      console.log('QR code ready')
    } catch (err) {
      console.error('Failed to render QR', err)
      latestQr = null
    }
  })

  client.on('ready', () => {
    status = 'connected'
    latestQr = null
    console.log('WhatsApp client ready')
    void applyLidWorkaround().catch((err) => {
      console.warn('Falha ao desativar LID', err)
    })
  })

  client.on('authenticated', () => {
    console.log('WhatsApp authenticated')
  })

  client.on('auth_failure', (msg) => {
    console.error('WhatsApp auth failure', msg)
    status = 'disconnected'
    latestQr = null
  })

  client.on('disconnected', (reason) => {
    console.log('WhatsApp disconnected', reason)
    status = 'disconnected'
    latestQr = null
  })

  try {
    await client.initialize()
  } catch (err) {
    console.error('WhatsApp initialize failed', err)
    status = 'disconnected'
    latestQr = null
    await destroyClient()
    clearBrowserLocks()
  } finally {
    starting = false
  }
}

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

app.get('/api/whatsapp/status', async (_req, res) => {
  if (status === 'connected') {
    const alive = await isPageAlive()
    if (!alive) {
      status = 'disconnected'
      latestQr = null
      void recoverClient('página WhatsApp morta (status)')
    }
  }

  res.json({
    status,
    qr: status === 'qr' ? latestQr : null,
  })
})

app.post('/api/whatsapp/start', async (_req, res) => {
  void createClient({ force: true })
  res.json({ ok: true, status: 'initializing' })
})

app.post('/api/whatsapp/logout', async (_req, res) => {
  try {
    if (client) {
      try {
        await client.logout()
      } catch {
        // ignore
      }
    }
    await destroyClient()
    clearBrowserLocks()
    fs.rmSync(AUTH_DIR, { recursive: true, force: true })
    status = 'disconnected'
    latestQr = null
    void createClient({ force: true })
    res.json({ ok: true })
  } catch (err) {
    console.error(err)
    res.status(500).json({ ok: false, error: 'Falha ao desconectar' })
  }
})

app.post('/api/whatsapp/send-one', async (req, res) => {
  if (status !== 'connected' || !client) {
    res.status(409).json({ ok: false, error: 'WhatsApp não conectado' })
    return
  }

  const { phone, text } = req.body ?? {}
  if (!phone || !text) {
    res.status(400).json({ ok: false, error: 'Telefone e texto são obrigatórios' })
    return
  }

  const chatId = toWhatsAppId(phone)
  const digits = chatId.replace('@c.us', '')
  if (!isValidWhatsAppDigits(digits)) {
    res.status(400).json({
      ok: false,
      error: 'Telefone incompleto — use DDD + número (10 ou 11 dígitos)',
    })
    return
  }

  try {
    await enqueueSend(async () => {
      if (!(await isPageAlive())) {
        throw new Error('detached Frame')
      }

      const started = Date.now()
      console.log(`send-one → ${digits}`)
      await sendMessageSimple(digits, text)
      console.log(`send-one ok ${digits} (${Date.now() - started}ms)`)
    })

    res.json({ ok: true })
  } catch (err) {
    console.error('send-one failed', err)
    const raw = err instanceof Error ? err.message : 'Falha ao enviar mensagem'

    if (isDetachedError(err)) {
      status = 'disconnected'
      latestQr = null
      void recoverClient('detached frame no envio')
      res.status(503).json({
        ok: false,
        error:
          'Conexão do WhatsApp caiu. Estamos reconectando — aguarde alguns segundos e tente de novo.',
      })
      return
    }

    res.status(500).json({ ok: false, error: raw })
  }
})

const server = app.listen(PORT, () => {
  console.log(`WhatsApp server on http://localhost:${PORT}`)
  void createClient({ force: true })
})

server.on('error', (err) => {
  console.error('Failed to start server', err)
  process.exit(1)
})
