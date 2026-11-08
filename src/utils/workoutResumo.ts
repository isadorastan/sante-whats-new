const STORAGE_KEY = 'sante-workout-resumo-v1'
const RESUMO_LINE = /^Resumo:\s*(.*)$/

export function splitWorkout(body: string): { summary: string[]; text: string } {
  const normalized = body.replace(/\r\n/g, '\n')
  const [first, ...rest] = normalized.split('\n')
  const match = first?.match(RESUMO_LINE)
  if (!match) return { summary: [], text: body }
  const summary = match[1]
    .split('·')
    .map((item) => item.trim())
    .filter(Boolean)
  if (rest[0] === '') rest.shift()
  return { summary, text: rest.join('\n') }
}

export function joinWorkout(summary: string[], text: string): string {
  if (summary.length === 0) return text
  const line = `Resumo: ${summary.join(' · ')}`
  const workout = text.replace(/^\n+/, '')
  return workout.trim() ? `${line}\n\n${workout}` : line
}

export function resumoKey(modality: string, date: string) {
  return `${modality}:${date}`
}

export function loadResumos(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const result: Record<string, string[]> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
        result[key] = value
      }
    }
    return result
  } catch {
    return {}
  }
}

export function saveResumos(value: Record<string, string[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}
