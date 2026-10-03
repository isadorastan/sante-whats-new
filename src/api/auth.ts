import { apiFetch, setToken } from './http'

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const data = (await res.json().catch(() => null)) as {
    token?: string
    error?: string
  } | null
  if (!res.ok || !data?.token) {
    throw new Error(data?.error || 'Usuário ou senha inválidos')
  }
  setToken(data.token)
}

export async function fetchMe(): Promise<{ ok: true; username: string }> {
  const res = await apiFetch('/api/auth/me')
  const data = (await res.json().catch(() => null)) as {
    ok?: boolean
    username?: string
    error?: string
  } | null
  if (!res.ok || !data?.username) {
    throw new Error(data?.error || 'Não autenticado')
  }
  return { ok: true, username: data.username }
}
