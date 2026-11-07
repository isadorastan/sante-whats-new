import type { ClassModality, ClassWeek as ClassWeekData, DayOfWeek } from '../types'
import { DAYS } from '../types'
import { formatIsoDate } from '../utils/dates'
import { addIsoDays, weekStartMonday } from '../utils/classDates'

const MODALITIES: { id: ClassModality; label: string }[] = [
  { id: 'hyrox', label: 'Hyrox' },
  { id: 'crossfit', label: 'Crossfit' },
]

function dayLabel(day: DayOfWeek): string {
  return DAYS.find((item) => item.id === day)?.label ?? day
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
  const days = current ? (week.modalities[current]?.days ?? []) : []
  const weekEnd = addIsoDays(week.weekStart, 6)
  const currentWeek = weekStartMonday(week.today)
  const nextWeek = addIsoDays(currentWeek, 7)
  const canGoBack = week.weekStart > currentWeek
  const canGoForward = week.weekStart < nextWeek

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
            return (
              <article key={key} className="class-day">
                <header className="class-day__head">
                  <div>
                    <h2>{dayLabel(day.day)}</h2>
                    <p>{formatIsoDate(day.date)}</p>
                  </div>
                </header>
                <p className="class-workout">
                  {day.workout.trim() ? day.workout : 'Treino ainda não saiu.'}
                </p>
                {day.slots.length === 0 ? (
                  <p className="class-empty">Nenhum horário neste dia.</p>
                ) : (
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
                          {slot.checkins.length > 0 ? (
                            <ul className="class-people">
                              {slot.checkins.map((person) => (
                                <li key={person.id}>
                                  {person.studentName}
                                  {person.mine ? ' (você)' : ''}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="class-people class-people--empty">Ninguém ainda.</p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </article>
            )
          })}
        </div>
        </>
      )}
    </section>
  )
}