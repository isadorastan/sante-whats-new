import { useState } from 'react'
import type { DayOfWeek, Session, Student } from '../types'
import { DAYS } from '../types'
import type { SessionInput, SessionUpdate } from '../api/data'
import { WeeklyBoard } from '../components/WeeklyBoard'

const WEEKDAYS: DayOfWeek[] = ['seg', 'ter', 'qua', 'qui', 'sex']

interface AgendaPageProps {
  students: Student[]
  sessions: Session[]
  onCreateSession: (input: SessionInput) => Promise<Session>
  onUpdateSession: (id: number, input: SessionUpdate) => Promise<Session>
  onDeleteSession: (id: number) => Promise<void>
}

export function AgendaPage({
  students,
  sessions,
  onCreateSession,
  onUpdateSession,
  onDeleteSession,
}: AgendaPageProps) {
  const [visibleDays, setVisibleDays] = useState<DayOfWeek[]>(WEEKDAYS)
  const [error, setError] = useState<string | null>(null)

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
