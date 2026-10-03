import type { IntervalMinutes } from '../types'

/** Gera slots HH:mm de startHour até endHour (exclusivo no fim), a cada interval minutos. */
export function generateTimeSlots(
  startHour: number,
  endHour: number,
  interval: IntervalMinutes,
): string[] {
  const slots: string[] = []
  const startMinutes = startHour * 60
  const endMinutes = endHour * 60

  for (let m = startMinutes; m < endMinutes; m += interval) {
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
