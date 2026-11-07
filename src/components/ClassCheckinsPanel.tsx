import { useEffect, useState } from 'react'
import { fetchClassWeek } from '../api/class'
import type { ClassModality, ClassWeek as ClassWeekData, DayOfWeek } from '../types'
import { DAYS } from '../types'
import { brazilToday, formatIsoDate } from '../utils/dates'
import { addIsoDays, weekStartMonday } from '../utils/classDates'
import { ClassActionLoading } from './ClassActionLoading'

const MODALITIES: { id: ClassModality; label: string }[] = [
  { id: 'crossfit', label: 'Crossfit' },
  { id: 'hyrox', label: 'Hyrox' },
]

function dayLabel(day: DayOfWeek): string {
  return DAYS.find((item) => item.id === day)?.label ?? day
}

export function ClassCheckinsPanel() {
  const [modality, setModality] = useState<ClassModality>('crossfit')
  const [weekStart, setWeekStart] = useState(() => weekStartMonday(brazilToday()))
  const [week, setWeek] = useState<ClassWeekData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchClassWeek(weekStart)
      .then((next) => {
        if (cancelled) return
        setWeek(next)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Falha ao carregar a semana')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [weekStart])

  const days = week?.modalities[modality]?.days ?? []
  const weekEnd = addIsoDays(weekStart, 6)

  return (
    <section className="class-week" aria-label="Check-in semanal">
      {loading && week ? <ClassActionLoading /> : null}
      <div className="class-week__nav">
        <button
          type="button"
          className="btn class-week__arrow"
          aria-label="Semana anterior"
          onClick={() => setWeekStart((current) => addIsoDays(current, -7))}
        >
          &lt;
        </button>
        <p className="class-week__range">
          {formatIsoDate(weekStart)} – {formatIsoDate(weekEnd)}
        </p>
        <button
          type="button"
          className="btn class-week__arrow"
          aria-label="Próxima semana"
          onClick={() => setWeekStart((current) => addIsoDays(current, 7))}
        >
          &gt;
        </button>
      </div>
      <div className="segmented class-modality" role="tablist" aria-label="Modalidade">
        {MODALITIES.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={modality === item.id}
            className={modality === item.id ? 'is-active' : undefined}
            onClick={() => setModality(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error ? <div className="whatsapp-banner whatsapp-banner--error">{error}</div> : null}
      {loading && !week ? <p className="page-status">Carregando...</p> : null}
      {!loading && days.length === 0 ? (
        <p className="class-empty">Nenhum dia ligado nesta modalidade.</p>
      ) : null}
      <div className="class-week__days">
        {days.map((day) => (
          <article key={day.date} className="class-day">
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
                {day.slots.map((slot) => (
                  <li key={slot.id} className="class-slot">
                    <div className="class-slot__top">
                      <strong style={{ marginRight: 'auto' }}>{slot.time}</strong>
                      <span>
                        {slot.checkins.length}/{slot.capacity}
                      </span>
                    </div>
                    {slot.checkins.length > 0 ? (
                      <ul className="class-people">
                        {slot.checkins.map((person) => (
                          <li key={person.id}>{person.studentName}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="class-people class-people--empty">Ninguém ainda.</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}
