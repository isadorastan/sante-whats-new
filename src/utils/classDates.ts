export function addIsoDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day + days))
  const nextYear = utc.getUTCFullYear()
  const nextMonth = String(utc.getUTCMonth() + 1).padStart(2, '0')
  const nextDay = String(utc.getUTCDate()).padStart(2, '0')
  return `${nextYear}-${nextMonth}-${nextDay}`
}

/** Segunda-feira da semana civil da data YYYY-MM-DD. */
export function weekStartMonday(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  const sundayBased = utc.getUTCDay()
  const delta = sundayBased === 0 ? -6 : 1 - sundayBased
  return addIsoDays(isoDate, delta)
}