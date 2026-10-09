function part(parts, type) {
  return parts.find((item) => item.type === type)?.value ?? ''
}

/** Data civil em America/Sao_Paulo, no formato YYYY-MM-DD. */
export function brazilToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  return `${part(parts, 'year')}-${part(parts, 'month')}-${part(parts, 'day')}`
}

/** Mês civil em America/Sao_Paulo, no formato YYYY-MM. */
export function brazilMonth(now = new Date()) {
  return brazilToday(now).slice(0, 7)
}
