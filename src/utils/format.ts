/** Mantém só dígitos do telefone. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Normaliza para telefone BR local (DDD + número), 10 ou 11 dígitos.
 * Só remove o DDI 55 quando o número já vem completo (12/13 dígitos).
 * DDD 55 (RS) é preservado — ex.: 55999815962 continua com DDD 55.
 */
export function normalizeBrazilPhone(value: string): string {
  let digits = digitsOnly(value)
  if (digits.startsWith('00')) digits = digits.slice(2)
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2)
  }
  return digits.slice(0, 11)
}

/** Formata telefone BR: (11) 98765-4321 */
export function formatPhone(value: string): string {
  const digits = normalizeBrazilPhone(value)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

/** Aceita "450", "450,00", "R$ 450,50" e devolve número. */
export function parseCurrencyInput(value: string): number | null {
  const cleaned = value
    .replace(/[R$\s]/gi, '')
    .replace(/\./g, '')
    .replace(',', '.')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) && n >= 0 ? n : null
}
