import { addIsoDays } from './dailySummary.js'

/** Segunda de 52 semanas antes da semana corrente, até hoje. */
export function summarizeCheckins(rows, { today, month, weekStart }) {
  const from = addIsoDays(weekStart, -52 * 7)
  let total = 0
  let monthCount = 0
  let weekCount = 0
  let crossfit = 0
  let hyrox = 0
  let firstOn = null
  const dayCounts = new Map()

  for (const row of rows) {
    const date = String(row.classOn).slice(0, 10)
    if (!date || date > today) continue
    total += 1
    if (date.startsWith(`${month}-`)) monthCount += 1
    if (date >= weekStart) weekCount += 1
    if (row.modality === 'crossfit') crossfit += 1
    if (row.modality === 'hyrox') hyrox += 1
    if (firstOn == null || date < firstOn) firstOn = date
    dayCounts.set(date, (dayCounts.get(date) ?? 0) + 1)
  }

  const days = [...dayCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, count]) => ({ date, count }))

  return {
    total,
    month: monthCount,
    week: weekCount,
    firstOn,
    crossfit,
    hyrox,
    from,
    today,
    days,
  }
}
