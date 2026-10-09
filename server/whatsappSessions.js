import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pino from 'pino'
import qrcode from 'qrcode'
import { toWhatsAppDigits } from './phone.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const AUTH_ROOT = path.join(__dirname, '.baileys')
const MIN_SEND_GAP_MS = 12_000
const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const logger = pino({ level: 'silent' })
/** @type {Map<string, Session>} */
const sessions = new Map()
/** @type {Promise<number[] | undefined> | null} */
let versionPromise = null

/**
 * @typedef {object} Session
 * @property {string} userId
 * @property {string} dir
 * @property {'disconnected' | 'qr' | 'connected' | 'initializing'} status
 * @property {string | null} qr
 * @property {import('@whiskeysockets/baileys').WASocket | null} sock
 * @property {boolean} starting
 * @property {boolean} closing
 * @property {Promise<void>} sendChain
 * @property {number} lastSentAt
 */

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sessionDir(userId) {
  if (!USER_ID.test(userId)) {
    const error = new Error('Usuário inválido')
    error.status = 400
    throw error
  }
  return path.join(AUTH_ROOT, userId)
}

function waVersion() {
  if (!versionPromise) {
    versionPromise = fetchLatestBaileysVersion()
      .then((result) => result.version)
      .catch(() => undefined)
  }
  return versionPromise
}

function createSlot(userId, dir) {
  return {
    userId,
    dir,
    status: 'disconnected',
    qr: null,
    sock: null,
    starting: false,
    closing: false,
    sendChain: Promise.resolve(),
    lastSentAt: 0,
  }
}

function publicStatus(session) {
  if (!session) return { status: 'disconnected', qr: null }
  return {
    status: session.status,
    qr: session.status === 'qr' ? session.qr : null,
  }
}

export function getWhatsAppStatus(userId) {
  if (!USER_ID.test(userId)) return { status: 'disconnected', qr: null }
  return publicStatus(sessions.get(userId))
}

export function isUserConnected(userId) {
  const session = sessions.get(userId)
  return Boolean(session && session.status === 'connected' && session.sock)
}

function enqueue(session, task) {
  const run = session.sendChain.then(
    () => paced(session, task),
    () => paced(session, task),
  )
  session.sendChain = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

async function paced(session, task) {
  const wait =
    session.lastSentAt === 0 ? 0 : MIN_SEND_GAP_MS - (Date.now() - session.lastSentAt)
  if (wait > 0) await delay(wait)
  try {
    return await task()
  } finally {
    session.lastSentAt = Date.now()
  }
}

async function openSocket(session) {
  if (session.starting || session.closing) return
  session.starting = true
  session.status = 'initializing'
  session.qr = null
  try {
    fs.mkdirSync(session.dir, { recursive: true })
    const { state, saveCreds } = await useMultiFileAuthState(session.dir)
    const version = await waVersion()
    const sock = makeWASocket({
      ...(version ? { version } : {}),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
      },
      logger,
      syncFullHistory: false,
      shouldSyncHistoryMessage: () => false,
      markOnlineOnConnect: false,
    })
    session.sock = sock
    sock.ev.on('creds.update', saveCreds)
    sock.ev.on('connection.update', (update) => {
      if (session.sock !== sock) return
      void onConnection(session, update)
    })
  } catch (err) {
    console.error('WhatsApp start', session.userId, err)
    session.status = 'disconnected'
    session.qr = null
    session.sock = null
  } finally {
    session.starting = false
  }
}

async function onConnection(session, update) {
  const { connection, lastDisconnect, qr } = update
  if (qr) {
    session.status = 'qr'
    try {
      session.qr = await qrcode.toDataURL(qr)
    } catch (err) {
      console.error('QR', session.userId, err)
      session.qr = null
    }
  }
  if (connection === 'open') {
    session.status = 'connected'
    session.qr = null
    console.log('WhatsApp conectado', session.userId)
    return
  }
  if (connection !== 'close') return

  const code = lastDisconnect?.error?.output?.statusCode
  if (session.sock) session.sock = null
  session.qr = null
  if (session.closing || sessions.get(session.userId) !== session) {
    session.status = 'disconnected'
    return
  }

  const loggedOut = code === DisconnectReason.loggedOut
  const stop =
    loggedOut ||
    code === DisconnectReason.forbidden ||
    code === DisconnectReason.connectionReplaced
  if (stop) {
    session.status = 'disconnected'
    if (loggedOut) fs.rmSync(session.dir, { recursive: true, force: true })
    console.log('WhatsApp desconectado', session.userId, code)
    return
  }

  console.log('WhatsApp reconectando', session.userId, code)
  session.status = 'initializing'
  setTimeout(() => {
    if (session.closing || sessions.get(session.userId) !== session) return
    void openSocket(session)
  }, 1500)
}

export async function startWhatsApp(userId) {
  const dir = sessionDir(userId)
  let session = sessions.get(userId)
  if (session?.status === 'connected' && session.sock) return
  if (session?.starting || session?.status === 'initializing' || session?.status === 'qr') return
  if (!session) {
    session = createSlot(userId, dir)
    sessions.set(userId, session)
  }
  await openSocket(session)
}

export async function logoutWhatsApp(userId) {
  const dir = sessionDir(userId)
  const session = sessions.get(userId)
  if (session) {
    session.closing = true
    session.status = 'disconnected'
    session.qr = null
    try {
      await session.sock?.logout()
    } catch {
      // a sessão já pode ter caído
    }
    try {
      session.sock?.end(undefined)
    } catch {
      // ignore
    }
    session.sock = null
    sessions.delete(userId)
  }
  fs.rmSync(dir, { recursive: true, force: true })
}

function logSend(userId, phone, ok, detail) {
  const line = `envio ${ok ? 'ok' : 'erro'} user=${userId} phone=${phone}${detail ? ` — ${detail}` : ''}`
  if (ok) console.log(line)
  else console.error(line)
}

export async function sendWhatsAppText(userId, phone, text) {
  const digits = toWhatsAppDigits(phone)
  const session = sessions.get(userId)
  if (!session || session.status !== 'connected' || !session.sock) {
    logSend(userId, digits, false, 'WhatsApp não conectado')
    const error = new Error('WhatsApp não conectado')
    error.status = 409
    throw error
  }

  return enqueue(session, async () => {
    const sock = session.sock
    if (!sock || session.status !== 'connected') {
      logSend(userId, digits, false, 'WhatsApp não conectado')
      const error = new Error('WhatsApp não conectado')
      error.status = 409
      throw error
    }

    let rows
    try {
      rows = await sock.onWhatsApp(digits)
    } catch (err) {
      throw logConnectionError(session, digits, err)
    }
    const hit = rows?.find((row) => row.exists && row.jid)
    if (!hit) {
      logSend(userId, digits, false, 'Número sem WhatsApp')
      const error = new Error('Número sem WhatsApp')
      error.status = 400
      throw error
    }

    try {
      await sock.sendMessage(hit.jid, { text })
      logSend(userId, digits, true)
    } catch (err) {
      throw logConnectionError(session, digits, err)
    }
  })
}

function logConnectionError(session, phone, err) {
  const wrapped = connectionError(session, err)
  const message = wrapped instanceof Error ? wrapped.message : 'Falha ao enviar mensagem'
  logSend(session.userId, phone, false, message)
  return wrapped
}

function connectionError(session, err) {
  const code = err?.output?.statusCode
  const dropped =
    code === DisconnectReason.connectionClosed ||
    code === DisconnectReason.connectionLost ||
    code === DisconnectReason.timedOut ||
    code === DisconnectReason.restartRequired
  if (!dropped) return err
  session.status = 'disconnected'
  session.qr = null
  if (!session.closing && sessions.get(session.userId) === session) {
    void openSocket(session)
  }
  const error = new Error(
    'Conexão do WhatsApp caiu. Estamos reconectando — aguarde alguns segundos e tente de novo.',
  )
  error.status = 503
  return error
}

export async function restoreSavedSessions() {
  if (!fs.existsSync(AUTH_ROOT)) return
  const entries = fs.readdirSync(AUTH_ROOT, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isDirectory() || !USER_ID.test(entry.name)) continue
    const dir = path.join(AUTH_ROOT, entry.name)
    if (!fs.existsSync(path.join(dir, 'creds.json'))) continue
    if (sessions.has(entry.name)) continue
    const session = createSlot(entry.name, dir)
    sessions.set(entry.name, session)
    void openSocket(session)
  }
}
