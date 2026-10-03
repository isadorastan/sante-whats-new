import './loadEnv.js'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const key =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

/** Cliente só de Auth. Não reutiliza o de dados, para o login não trocar a chave do CRUD. */
const auth = url && key
  ? createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null

function bearerToken(req) {
  const header = req.headers.authorization ?? ''
  return header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
}

export async function requireAuth(req, res, next) {
  const token = bearerToken(req)
  if (!token || !auth) {
    res.status(401).json({ error: 'Não autenticado' })
    return
  }

  const { data, error } = await auth.auth.getUser(token)
  if (error || !data.user) {
    res.status(401).json({ error: 'Não autenticado' })
    return
  }

  req.user = {
    id: data.user.id,
    username: data.user.email ?? data.user.id,
  }
  next()
}

export async function login(req, res) {
  const email = String(req.body?.email ?? req.body?.username ?? '').trim()
  const password = String(req.body?.password ?? '')
  if (!email || !password) {
    res.status(400).json({ error: 'E-mail e senha são obrigatórios' })
    return
  }
  if (!auth) {
    res.status(503).json({ error: 'Supabase não configurado' })
    return
  }

  try {
    const { data, error } = await auth.auth.signInWithPassword({
      email,
      password,
    })

    if (error || !data.session) {
      const message = error?.message ?? ''
      if (/email not confirmed/i.test(message)) {
        res.status(401).json({ error: 'E-mail ainda não confirmado no Supabase' })
        return
      }
      if (/invalid login credentials/i.test(message)) {
        res.status(401).json({ error: 'Usuário ou senha inválidos' })
        return
      }
      console.error('POST /api/auth/login', error)
      res.status(500).json({ error: 'Falha ao entrar' })
      return
    }

    res.json({ token: data.session.access_token })
  } catch (err) {
    console.error('POST /api/auth/login', err)
    res.status(500).json({ error: 'Falha ao entrar' })
  }
}

export function me(req, res) {
  res.json({ ok: true, username: req.user.username })
}
