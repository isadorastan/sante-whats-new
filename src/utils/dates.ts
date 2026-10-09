function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes) {
  return parts.find((item) => item.type === type)?.value ?? ''
}

/** Data civil em America/Sao_Paulo, no formato YYYY-MM-DD. */
export function brazilToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`
}

/** Mês civil em America/Sao_Paulo, no formato YYYY-MM. */
export function brazilMonth(now = new Date()): string {
  return brazilToday(now).slice(0, 7)
}

/** Soma meses a um YYYY-MM. O resultado continua no formato YYYY-MM. */
export function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
  const nextYear = date.getUTCFullYear()
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${nextYear}-${nextMonth}`
}

const MONTH_LABELS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}/${month}/${year}`
}

export function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split('-')
  const label = MONTH_LABELS[Number(monthNumber) - 1] ?? month
  return `${label} de ${year}`
}

export function formatMonths(value: number | null): string {
  if (value === null) return '—'
  const label = value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  return `${label} ${value === 1 ? 'mês' : 'meses'}`
}
