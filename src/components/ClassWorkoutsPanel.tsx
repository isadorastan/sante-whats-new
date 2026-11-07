import { useEffect, useState } from 'react'
import { fetchClassWorkouts, saveClassWorkout } from '../api/class'
import type { ClassModality, ClassWorkoutWeek, DayOfWeek } from '../types'
import { DAYS } from '../types'
import { brazilToday, formatIsoDate } from '../utils/dates'
import { addIsoDays, weekStartMonday } from '../utils/classDates'

const MODALITIES: { id: ClassModality; label: string }[] = [
  { id: 'crossfit', label: 'Crossfit' },
  { id: 'hyrox', label: 'Hyrox' },
]

function dayLabel(day: DayOfWeek): string {
  return DAYS.find((item) => item.id === day)?.label ?? day
}

export function ClassWorkoutsPanel() {
  const [modality, setModality] = useState<ClassModality>('crossfit')
  const [weekStart, setWeekStart] = useState(() => weekStartMonday(brazilToday()))
  const [week, setWeek] = useState<ClassWorkoutWeek | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [savedDate, setSavedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSavedDate(null)
    void fetchClassWorkouts(modality, weekStart)
      .then((next) => {
        if (cancelled) return
        setWeek(next)
        const nextDrafts: Record<string, string> = {}
        for (const day of next.days) nextDrafts[day.date] = day.body
        setDrafts(nextDrafts)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Falha ao carregar')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [modality, weekStart])

  async function save(date: string) {
    setError(null)
    setSavedDate(null)
    try {
      const body = drafts[date] ?? ''
      await saveClassWorkout({ modality, date, body })
      setWeek((current) =>
        current
          ? {
              ...current,
              days: current.days.map((day) => (day.date === date ? { ...day, body } : day)),
            }
          : current,
      )
      setSavedDate(date)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar o treino')
    }
  }

  const weekEnd = addIsoDays(weekStart, 6)

  return (
    <div className="class-panel">
      <p className="class-note">
        O treino é do dia, vale para todos os horários da modalidade aberta, e muda toda semana.
        Aluno só de Crossfit não vê o treino salvo em Hyrox.
      </p>
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
      <div className="class-week__nav">
        <button
          type="button"
          className="btn"
          onClick={() => setWeekStart((current) => addIsoDays(current, -7))}
        >
          Semana anterior
        </button>
        <p className="class-week__range">
          {formatIsoDate(weekStart)} – {formatIsoDate(weekEnd)}
        </p>
        <button
          type="button"
          className="btn"
          onClick={() => setWeekStart((current) => addIsoDays(current, 7))}
        >
          Próxima semana
        </button>
      </div>
      {error ? <div className="whatsapp-banner whatsapp-banner--error">{error}</div> : null}
      {loading ? <p className="page-status">Carregando treinos...</p> : null}
      <div className="class-week__days">
        {(week?.days ?? []).map((day) => (
          <article key={day.date} className="class-day">
            <header className="class-day__head">
              <div>
                <h2>{dayLabel(day.day)}</h2>
                <p>{formatIsoDate(day.date)}</p>
              </div>
            </header>
            <label className="students-field">
              <span>Treino</span>
              <textarea
                className="students-form__input class-workout-input"
                rows={8}
                value={drafts[day.date] ?? ''}
                onChange={(event) =>
                  setDrafts((current) => ({ ...current, [day.date]: event.target.value }))
                }
              />
            </label>
            <button type="button" className="btn btn--primary class-workout-save" onClick={() => void save(day.date)}>
              {day.body.trim() ? 'Salvar treino' : 'Adicionar treino'}
            </button>
            {savedDate === day.date ? <p className="class-note">Treino salvo.</p> : null}
          </article>
        ))}
      </div>
    </div>
  )
}