import { randomBytes } from 'node:crypto'
import { isValidWhatsAppPhone, toWhatsAppDigits } from './phone.js'

const LOGIN_DOMAIN = 'alunos.sante.invalid'
const DEFAULT_STUDENT_URL = 'https://ctfsante.com.br/aluno'

export function normalizeUsername(raw) {
  const username = String(raw ?? '').trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) return ''
  return username
}

export function studentLoginEmail(username) {
  return `${username}@${LOGIN_DOMAIN}`
}

export function resolveLoginEmail(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return ''
  if (value.includes('@')) return value.toLowerCase()
  const username = normalizeUsername(value)
  return username ? studentLoginEmail(username) : ''
}

export function normalizePhone(raw) {
  if (!isValidWhatsAppPhone(raw)) return ''
  return toWhatsAppDigits(raw)
}

export function studentAccessUrl() {
  const configured = String(process.env.STUDENT_APP_URL ?? '').trim()
  return configured || DEFAULT_STUDENT_URL
}

export function newStudentPassword() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'
  return [...randomBytes(8)].map((byte) => alphabet[byte % alphabet.length]).join('')
}

export function accessLink(url, username, password) {
  const link = new URL(url)
  link.searchParams.set('email', username)
  link.searchParams.set('senha', password)
  return link.toString()
}

export function welcomeMessage({ name, username, password, url = studentAccessUrl() }) {
  const hello = name ? `Olá, ${name}.` : 'Olá.'
  const link = accessLink(url, username, password)
  return `${hello} Seu acesso ao check-in da Santé:\n\n${link}\n\nUsuário: ${username}\nSenha: ${password}`
}

export function formatBrazilPhone(phone) {
  const digits = toWhatsAppDigits(phone)
  const local = digits.startsWith('55') && digits.length > 11 ? digits.slice(2) : digits
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  }
  return String(phone ?? '').trim()
}
