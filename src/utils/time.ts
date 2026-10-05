/** Primeiro horário da grade (05:30) e fim exclusivo (21:00). */
const AGENDA_START_MINUTES = 5 * 60 + 30
const AGENDA_END_MINUTES = 21 * 60
const SLOT_MINUTES = 30

/** Gera slots HH:mm das 05:30 até 21:00 (exclusivo no fim), a cada 30 minutos. */
export function generateTimeSlots(): string[] {
  const slots: string[] = []

  for (let m = AGENDA_START_MINUTES; m < AGENDA_END_MINUTES; m += SLOT_MINUTES) {
    const h = Math.floor(m / 60)
    const min = m % 60
    slots.push(`${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`)
  }

  return slots
}

export function slotId(day: string, time: string): string {
  return `${day}__${time}`
}

export function parseSlotId(id: string): { day: string; time: string } | null {
  const [day, time] = id.split('__')
  if (!day || !time) return null
  return { day, time }
}
