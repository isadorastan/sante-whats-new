import { useState } from 'react'
import type { DayOfWeek, IntervalMinutes, Session, Student } from '../types'
import { DAYS } from '../types'
import type { SessionInput, SessionUpdate } from '../api/data'
import { WeeklyBoard } from '../components/WeeklyBoard'
import { generateTimeSlots } from '../utils/time'

const WEEKDAYS: DayOfWeek[] = ['seg', 'ter', 'qua', 'qui', 'sex']

function snapToInterval(time: string, interval: IntervalMinutes): string {
  const [h, m] = time.split(':').map(Number)
  const total = h * 60 + m
  const snapped = Math.round(total / interval) * interval
  const slots = generateTimeSlots(interval)
  const hh = String(Math.floor(snapped / 60)).padStart(2, '0')
  const mm = String(snapped % 60).padStart(2, '0')
  const candidate = `${hh}:${mm}`
  return slots.includes(candidate) ? candidate : slots[slots.length - 1]
}

interface AgendaPageProps {
  students: Student[]
  sessions: Session[]
  onCreateSession: (input: SessionInput) => Promise<Session>
  onUpdateSession: (id: number, input: SessionUpdate) => Promise<Session>
  onDeleteSession: (id: number) => Promise<void>
  onBulkUpdateSessions: (
    items: { id: number; day?: DayOfWeek; time?: string }[],
  ) => Promise<void>
}

export function AgendaPage({
  students,
  sessions,
  onCreateSession,
  onUpdateSession,
  onDeleteSession,
  onBulkUpdateSessions,
}: AgendaPageProps) {
  const [interval, setInterval] = useState<IntervalMinutes>(30)
  const [visibleDays, setVisibleDays] = useState<DayOfWeek[]>(WEEKDAYS)
  const [error, setError] = useState<string | null>(null)

  async function handleIntervalChange(next: IntervalMinutes) {
    setInterval(next)
    const updates = sessions
      .map((s) => {
        const time = snapToInterval(s.time, next)
        return time === s.time ? null : { id: s.id, time }
      })
      .filter((u): u is { id: number; time: string } => u !== null)

    if (updates.length === 0) return

    setError(null)
    try {
      await onBulkUpdateSessions(updates)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao ajustar horários',
      )
    }
  }

  function toggleDay(day: DayOfWeek) {
    setVisibleDays((prev) => {
      if (prev.includes(day)) {
        if (prev.length === 1) return prev
        return prev.filter((d) => d !== day)
      }
      return DAYS.map((d) => d.id).filter((id) => prev.includes(id) || id === day)
    })
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Agenda</h1>
          <p className="page-header__subtitle">
            Arraste alunos entre horários ou adicione com o +
          </p>
        </div>

        <div className="page-header__controls">
          <div className="page-header__control">
            <span className="page-header__label">Intervalo</span>
            <div className="segmented" role="group" aria-label="Intervalo de horários">
              <button
                type="button"
                className={interval === 15 ? 'is-active' : undefined}
                onClick={() => void handleIntervalChange(15)}
              >
                15 min
              </button>
              <button
                type="button"
                className={interval === 30 ? 'is-active' : undefined}
                onClick={() => void handleIntervalChange(30)}
              >
                30 min
              </button>
            </div>
          </div>

          <div className="page-header__control">
            <span className="page-header__label">Dias</span>
            <div className="segmented segmented--days" role="group" aria-label="Dias da semana">
              {DAYS.map((day) => {
                const active = visibleDays.includes(day.id)
                return (
                  <button
                    key={day.id}
                    type="button"
                    className={active ? 'is-active' : undefined}
                    aria-pressed={active}
                    title={active ? `Ocultar ${day.label}` : `Mostrar ${day.label}`}
                    onClick={() => toggleDay(day.id)}
                  >
                    {day.short}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </header>

      <div className="page-body">
        {error ? (
          <div className="whatsapp-banner whatsapp-banner--error">{error}</div>
        ) : null}
        <WeeklyBoard
          students={students}
          sessions={sessions}
          interval={interval}
          visibleDays={visibleDays}
          onCreateSession={onCreateSession}
          onUpdateSession={onUpdateSession}
          onDeleteSession={onDeleteSession}
          onError={setError}
        />
      </div>
    </div>
  )
}
