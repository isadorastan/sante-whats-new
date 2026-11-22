/** Agrupa check-ins até hoje. Mês vazio conta o histórico inteiro. */
export function rankCheckins(rows, { today, month, studentId }) {
  const groups = new Map()
  for (const row of rows) {
    const date = String(row.classOn).slice(0, 10)
    if (!date || date > today) continue
    if (month && !date.startsWith(`${month}-`)) continue
    const id = row.studentId == null ? null : Number(row.studentId)
    const key = id == null ? `name:${row.name}` : `id:${id}`
    const current = groups.get(key) ?? { studentId: id, name: row.name, count: 0, latest: '' }
    current.count += 1
    if (date >= current.latest) {
      current.name = row.name
      current.latest = date
    }
    groups.set(key, current)
  }

  return [...groups.values()]
    .filter((item) => item.count > 0)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count
      return a.name.localeCompare(b.name, 'pt-BR')
    })
    .map((item, index) => ({
      rank: index + 1,
      name: item.name,
      count: item.count,
      mine: item.studentId != null && item.studentId === Number(studentId),
    }))
}
