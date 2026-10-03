export type WhatsAppConnectionStatus =
  | 'disconnected'
  | 'initializing'
  | 'qr'
  | 'connected'

export interface WhatsAppStatusResponse {
  status: WhatsAppConnectionStatus
  qr: string | null
}

export interface SendOnePayload {
  phone: string
  text: string
  name: string
}

export interface SendOneResult {
  ok: boolean
  error?: string
}

export async function fetchWhatsAppStatus(): Promise<WhatsAppStatusResponse> {
  const res = await fetch('/api/whatsapp/status')
  if (!res.ok) throw new Error('Falha ao consultar status do WhatsApp')
  return res.json()
}

export async function startWhatsApp(): Promise<void> {
  const res = await fetch('/api/whatsapp/start', { method: 'POST' })
  if (!res.ok) throw new Error('Falha ao iniciar conexão WhatsApp')
}

export async function logoutWhatsApp(): Promise<void> {
  const res = await fetch('/api/whatsapp/logout', { method: 'POST' })
  if (!res.ok) throw new Error('Falha ao desconectar WhatsApp')
}


export async function sendWhatsAppOne(
  payload: SendOnePayload,
  signal?: AbortSignal,
): Promise<SendOneResult> {
  const res = await fetch('/api/whatsapp/send-one', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })

  const data = (await res.json().catch(() => null)) as SendOneResult | null
  if (!res.ok) {
    return { ok: false, error: data?.error ?? 'Falha ao enviar mensagem' }
  }
  return data ?? { ok: true }
}

export function toWhatsAppPhone(phone: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('00')) digits = digits.slice(2)

  // Já internacional: DDI 55 + DDD + número (12 ou 13 dígitos)
  if (
    (digits.length === 12 || digits.length === 13) &&
    digits.startsWith('55')
  ) {
    return digits
  }

  // Local BR (10/11 dígitos), inclusive DDD 55 → vira 5555...
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`
  }

  return digits
}

export function isValidWhatsAppPhone(phone: string): boolean {
  const digits = toWhatsAppPhone(phone)
  return digits.length === 12 || digits.length === 13
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
