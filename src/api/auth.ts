import { apiFetch, apiUrl, setToken } from './http'

export type AccountRole = 'professor' | 'student'

export interface Account {
  ok: true
  username: string
  role: AccountRole
  name: string | null
  crossfit: boolean
  hyrox: boolean
}

export async function login(email: string, password: string): Promise<AccountRole> {
  const res = await fetch(apiUrl('/api/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = (await res.json().catch(() => null)) as {
    token?: string
    role?: string
    error?: string
  } | null
  if (!res.ok || !data?.token) {
    throw new Error(data?.error || 'Usuário ou senha inválidos')
  }
  setToken(data.token)
  return data.role === 'student' ? 'student' : 'professor'
}

export async function fetchMe(): Promise<Account> {
  const res = await apiFetch('/api/auth/me')
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean
    username?: string
    role?: string
    name?: string | null
    crossfit?: boolean
    hyrox?: boolean
    error?: string
  } | null
  if (!res.ok || !data?.username) {
    throw new Error(data?.error || 'Não autenticado')
  }
  return {
    ok: true,
    username: data.username,
    role: data.role === 'student' ? 'student' : 'professor',
    name: data.name ?? null,
    crossfit: data.crossfit === true,
    hyrox: data.hyrox === true,
  }
}
