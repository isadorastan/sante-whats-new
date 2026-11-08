import { useState } from 'react'
import type { ClassModality, ClassWeek as ClassWeekData, DayOfWeek } from '../types'
import { DAYS } from '../types'
import { formatIsoDate } from '../utils/dates'
import { addIsoDays, weekStartMonday } from '../utils/classDates'
import { splitWorkout } from '../utils/workoutResumo'

const MODALITIES: { id: ClassModality; label: string }[] = [
  { id: 'hyrox', label: 'Hyrox' },
  { id: 'crossfit', label: 'Crossfit' },
]

function dayLabel(day: DayOfWeek): string {
  return DAYS.find((item) => item.id === day)?.label ?? day
}

function initial(name: string): string {
  const letter = name.trim().charAt(0)
  return letter ? letter.toLocaleUpperCase('pt-BR') : '?'
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      {off ? (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M9.9 5.2A10.4 10.4 0 0 1 12 5c5.2 0 9.2 4.2 10.2 6.5a12 12 0 0 1-2.2 3.2M6.2 6.3C4.4 7.6 3 9.4 1.8 12c1 2.4 4.8 6.5 10.2 6.5 1.4 0 2.8-.3 4-.8"
        />
      ) : (
        <>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"
          />
          <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </>
      )}
    </svg>
  )
}

function closedLabel(reason: string | null | undefined): string {
  if (reason === 'past' || reason === 'started') return 'Esse horário já passou'
  if (reason === 'too_far') return 'Check-in só até a semana que vem'
  return 'Check-in fechado'
}

interface ClassWeekProps {
  week: ClassWeekData
  modality: ClassModality
  onModality: (modality: ClassModality) => void
  onShiftWeek: (delta: number) => void
  onCheckIn: (slotId: number, date: string) => Promise<void>
  onCancel: (checkinId: number) => Promise<void>
  busyId: string | null
}

export function ClassWeek({
  week,
  modality,
  onModality,
  onShiftWeek,
  onCheckIn,
  onCancel,
  busyId,
}: ClassWeekProps) {
  const visible = MODALITIES.filter((item) => week.modalities[item.id])
  const current = visible.some((item) => item.id === modality) ? modality : visible[0]?.id
  const days = (current ? (week.modalities[current]?.days ?? []) : []).filter(
    (day) => day.slots.length > 0,
  )
  const weekEnd = addIsoDays(week.weekStart, 6)
  const currentWeek = weekStartMonday(week.today)
  const nextWeek = addIsoDays(currentWeek, 7)
  const canGoBack = week.weekStart > currentWeek
  const canGoForward = week.weekStart < nextWeek
  const [openWorkout, setOpenWorkout] = useState<string | null>(null)

  return (
    <section className="class-week" aria-label="Agenda da semana">
      <div className="class-week__nav">
        {canGoBack ? (
          <button
            type="button"
            className="btn class-week__arrow"
            aria-label="Semana anterior"
            onClick={() => onShiftWeek(-1)}
          >
            &lt;
          </button>
        ) : (
          <span className="class-week__arrow" aria-hidden="true" />
        )}
        <p className="class-week__range">
          {formatIsoDate(week.weekStart)} – {formatIsoDate(weekEnd)}
        </p>
        {canGoForward ? (
          <button
            type="button"
            className="btn class-week__arrow"
            aria-label="Próxima semana"
            onClick={() => onShiftWeek(1)}
          >
            &gt;
          </button>
        ) : (
          <span className="class-week__arrow" aria-hidden="true" />
        )}
      </div>

      {visible.length > 1 ? (
        <div className="segmented class-modality" role="tablist" aria-label="Modalidade">
          {visible.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={current === item.id}
              className={current === item.id ? 'is-active' : undefined}
              onClick={() => onModality(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}

      {visible.length === 0 ? (
        <p className="class-empty">Nenhuma modalidade liberada para esta conta.</p>
      ) : null}

      {days.length === 0 ? (
        <p className="class-empty">Nenhum dia ligado nesta modalidade.</p>
      ) : (
        <>
      {days.some((day) => day.slots.length > 0) &&
      days.every((day) => day.slots.every((slot) => !slot.canJoin && !slot.canLeave)) ? (
        <p className="class-note">
          {days.some((day) => day.slots.some((slot) => slot.closedReason === 'too_far'))
            ? 'O check-in dessa semana ainda não abriu.'
            : 'Os horários desta semana já passaram. Na próxima semana dá para entrar.'}
        </p>
      ) : null}
        <div className="class-week__days">
          {days.map((day) => {
            const key = `${current}:${day.date}`
            const { summary, text } = splitWorkout(day.workout)
            const workoutOpen = openWorkout === key
            const hasWorkout = text.trim().length > 0
            return (
              <article key={key} className="class-day">
                <header className="class-day__head">
                  <div>
                    <h2>{dayLabel(day.day)}</h2>
                    <p>{formatIsoDate(day.date)}</p>
                  </div>
                </header>
                {summary.length > 0 ? (
                  <div className="workout-presets__items class-resumo">
                    {summary.map((item) => (
                      <span key={item} className="workout-chip">
                        <span className="workout-chip__label">{item}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
                {hasWorkout ? (
                  <button
                    type="button"
                    className="btn class-workout-toggle"
                    aria-expanded={workoutOpen}
                    onClick={() => setOpenWorkout(workoutOpen ? null : key)}
                  >
                    <EyeIcon off={workoutOpen} />
                    {workoutOpen ? 'Ocultar treino' : 'Ver treino completo'}
                  </button>
                ) : summary.length === 0 ? (
                  <p className="class-workout">Treino ainda não saiu.</p>
                ) : null}
                {workoutOpen && hasWorkout ? <p className="class-workout">{text}</p> : null}
                <ul className="class-slots">
                    {day.slots.map((slot) => {
                      const actionId = `${day.date}-${slot.id}`
                      const myCheckinId = slot.myCheckinId
                      const leaveId = myCheckinId ? `leave-${myCheckinId}` : ''
                      const busy = busyId === actionId || busyId === leaveId
                      return (
                        <li key={slot.id} className="class-slot">
                          <div className="class-slot__top">
                            <strong style={{ marginRight: 'auto' }}>{slot.time}</strong>
                            <span>
                              {slot.checkins.length}/{slot.capacity}
                            </span>
                            {slot.canLeave && myCheckinId ? (
                              <button
                                type="button"
                                className="btn"
                                disabled={busy}
                                onClick={() => void onCancel(myCheckinId)}
                              >
                                {busy ? 'Saindo...' : 'Sair da aula'}
                              </button>
                            ) : null}
                            {slot.canJoin ? (
                              <button
                                type="button"
                                className="btn btn--primary"
                                disabled={busy}
                                onClick={() => void onCheckIn(slot.id, day.date)}
                              >
                                {busy ? 'Entrando...' : 'Fazer check-in'}
                              </button>
                            ) : null}
                            {!slot.canJoin && !slot.canLeave && slot.checkins.length >= slot.capacity ? (
                              <span className="class-slot__status">Lotado</span>
                            ) : null}
                            {!slot.canJoin && !slot.canLeave && slot.checkins.length < slot.capacity ? (
                              <span className="class-slot__status">{closedLabel(slot.closedReason)}</span>
                            ) : null}
                          </div>
                          <div className="class-slot__people">
                            <p className="class-slot__label">Confirmados</p>
                            {slot.checkins.length > 0 ? (
                              <ul className="class-people">
                                {slot.checkins.map((person) => (
                                  <li key={person.id} className={person.mine ? 'is-mine' : undefined}>
                                    <span className="class-people__mark" aria-hidden="true">
                                      {initial(person.studentName)}
                                    </span>
                                    <span>{person.studentName}</span>
                                    {person.mine ? <span className="class-people__you">você</span> : null}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="class-people--empty">Ninguém ainda.</p>
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
              </article>
            )
          })}
        </div>
        </>
      )}
    </section>
  )
}