import './loadEnv.js'
import { createClient } from '@supabase/supabase-js'
import { supabase } from './db.js'
import { resolveLoginEmail } from './studentAccount.js'

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

/** Conta sem papel continua professor. Aluno só entra com role student no app_metadata. */
export function roleFromUser(user) {
  return user?.app_metadata?.role === 'student' ? 'student' : 'professor'
}

export function requireProfessor(req, res, next) {
  if (req.user?.role === 'student') {
    res.status(403).json({ error: 'Acesso só do professor' })
    return
  }
  next()
}

export function requireStudent(req, res, next) {
  if (req.user?.role !== 'student') {
    res.status(403).json({ error: 'Acesso só do aluno' })
    return
  }
  next()
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

  const role = roleFromUser(data.user)
  req.user = {
    id: data.user.id,
    username: data.user.email ?? data.user.id,
    role,
    professorId:
      role === 'student' ? data.user.app_metadata?.professor_id ?? null : data.user.id,
  }
  next()
}

export async function login(req, res) {
  const identifier = String(req.body?.email ?? req.body?.username ?? '').trim()
  const password = String(req.body?.password ?? '')
  const email = resolveLoginEmail(identifier)
  if (!identifier || !password) {
    res.status(400).json({ error: 'Usuário e senha são obrigatórios' })
    return
  }
  if (!email) {
    res.status(401).json({ error: 'Usuário ou senha inválidos' })
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

    res.json({
      token: data.session.access_token,
      role: roleFromUser(data.user),
    })
  } catch (err) {
    console.error('POST /api/auth/login', err)
    res.status(500).json({ error: 'Falha ao entrar' })
  }
}

export async function me(req, res) {
  const body = {
    ok: true,
    username: req.user.username,
    role: req.user.role ?? 'professor',
    name: null,
    crossfit: false,
    hyrox: false,
  }
  if (body.role !== 'student') {
    res.json(body)
    return
  }

  try {
    if (!supabase) {
      res.json(body)
      return
    }
    const { data, error } = await supabase
      .from('class_students')
      .select('name, crossfit, hyrox')
      .eq('auth_user_id', req.user.id)
      .maybeSingle()
    if (error) {
      console.error('GET /api/auth/me', error)
      res.status(500).json({ error: 'Falha ao validar sessão' })
      return
    }
    body.name = data?.name ?? null
    body.crossfit = Boolean(data?.crossfit)
    body.hyrox = Boolean(data?.hyrox)
    res.json(body)
  } catch (err) {
    console.error('GET /api/auth/me', err)
    res.status(500).json({ error: 'Falha ao validar sessão' })
  }
}
