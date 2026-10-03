const TOKEN_KEY = 'sante-auth'

export function apiUrl(path: string) {
  const base = String(import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
  return `${base}${path}`
}

type UnauthorizedHandler = () => void

let onUnauthorized: UnauthorizedHandler | null = null

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler
}

export async function apiFetch(input: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const token = getToken()
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const res = await fetch(apiUrl(input), { ...init, headers })
  if (res.status === 401) {
    clearToken()
    onUnauthorized?.()
  }
  return res
}
