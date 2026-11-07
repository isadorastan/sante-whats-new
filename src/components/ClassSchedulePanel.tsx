import { useEffect, useState, type FormEvent } from 'react'
import { ClassActionLoading } from './ClassActionLoading'
import {
  NeedsConfirmError,
  createClassSlot,
  deleteClassSlot,
  fetchClassSchedule,
  saveClassDays,
  updateClassSlot,
} from '../api/class'
import type { ClassModality, ClassSchedule, DayOfWeek } from '../types'
import { DAYS } from '../types'

const MODALITIES: { id: ClassModality; label: string }[] = [
  { id: 'crossfit', label: 'Crossfit' },
  { id: 'hyrox', label: 'Hyrox' },
]

export function ClassSchedulePanel() {
  const [modality, setModality] = useState<ClassModality>('crossfit')
  const [schedule, setSchedule] = useState<ClassSchedule | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [pendingDays, setPendingDays] = useState<DayOfWeek[] | null>(null)
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const [pendingSlotId, setPendingSlotId] = useState<number | null>(null)
  const [newDay, setNewDay] = useState<DayOfWeek>('seg')
  const [newTime, setNewTime] = useState('')
  const [newCapacity, setNewCapacity] = useState('12')
  const [edits, setEdits] = useState<Record<number, { time: string; capacity: string }>>({})

  function editsFrom(next: ClassSchedule) {
    const values: Record<number, { time: string; capacity: string }> = {}
    for (const slot of next.slots) {
      values[slot.id] = { time: slot.time, capacity: String(slot.capacity) }
    }
    return values
  }

  async function reload(nextModality = modality) {
    const next = await fetchClassSchedule(nextModality)
    setSchedule(next)
    setEdits(editsFrom(next))
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setPendingDays(null)
    setPendingMessage(null)
    setPendingSlotId(null)
    void fetchClassSchedule(modality)
      .then((next) => {
        if (cancelled) return
        setSchedule(next)
        setEdits(editsFrom(next))
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
  }, [modality])

  async function persistDays(days: DayOfWeek[], confirm = false) {
    setActing(true)
    setError(null)
    try {
      await saveClassDays({ modality, days, confirm })
      setPendingDays(null)
      setPendingMessage(null)
      await reload()
    } catch (err) {
      if (err instanceof NeedsConfirmError && !confirm) {
        setPendingDays(days)
        setPendingMessage(err.message)
        return
      }
      setError(err instanceof Error ? err.message : 'Falha ao salvar os dias')
    } finally {
      setActing(false)
    }
  }

  function toggleDay(day: DayOfWeek) {
    if (!schedule) return
    const days = schedule.days.includes(day)
      ? schedule.days.filter((item) => item !== day)
      : [...schedule.days, day]
    void persistDays(days)
  }

  async function addSlot(event: FormEvent) {
    event.preventDefault()
    setActing(true)
    setError(null)
    try {
      await createClassSlot({
        modality,
        day: newDay,
        time: newTime,
        capacity: Number(newCapacity),
      })
      setNewTime('')
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao criar o horário')
    } finally {
      setActing(false)
    }
  }

  async function saveSlot(id: number) {
    const edit = edits[id]
    if (!edit) return
    setActing(true)
    setError(null)
    try {
      await updateClassSlot(id, { time: edit.time, capacity: Number(edit.capacity) })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar o horário')
    } finally {
      setActing(false)
    }
  }

  async function removeSlot(id: number, confirm = false) {
    setActing(true)
    setError(null)
    try {
      await deleteClassSlot(id, confirm)
      setPendingSlotId(null)
      setPendingMessage(null)
      await reload()
    } catch (err) {
      if (err instanceof NeedsConfirmError && !confirm) {
        setPendingSlotId(id)
        setPendingDays(null)
        setPendingMessage(err.message)
        return
      }
      setError(err instanceof Error ? err.message : 'Falha ao apagar o horário')
    } finally {
      setActing(false)
    }
  }

  return (
    <div className="class-panel">
      {acting ? <ClassActionLoading /> : null}
      <p className="class-note">
        Os dias e horários valem para todas as semanas. O treino muda na gestão de treinos.
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
      {error ? <div className="whatsapp-banner whatsapp-banner--error">{error}</div> : null}
      {pendingMessage ? (
        <div className="class-confirm">
          <p>{pendingMessage}</p>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => {
              if (pendingSlotId !== null) void removeSlot(pendingSlotId, true)
              else if (pendingDays) void persistDays(pendingDays, true)
            }}
          >
            Confirmar
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setPendingDays(null)
              setPendingSlotId(null)
              setPendingMessage(null)
            }}
          >
            Cancelar
          </button>
        </div>
      ) : null}
      {loading ? <p className="page-status">Carregando horários...</p> : null}
      <form className="students-form" onSubmit={(event) => void addSlot(event)}>
        <p className="students-form__label">Adicionar horário</p>
        <div className="class-form-grid">
          <label className="students-field">
            <span>Dia</span>
            <select
              className="students-form__input"
              value={newDay}
              onChange={(event) => setNewDay(event.target.value as DayOfWeek)}
            >
              {DAYS.map((day) => (
                <option key={day.id} value={day.id}>
                  {day.label}
                </option>
              ))}
            </select>
          </label>
          <label className="students-field">
            <span>Horário</span>
            <input
              className="students-form__input"
              type="time"
              value={newTime}
              onChange={(event) => setNewTime(event.target.value)}
              required
            />
          </label>
          <label className="students-field">
            <span>Máximo de alunos</span>
            <input
              className="students-form__input"
              type="number"
              min={1}
              max={500}
              value={newCapacity}
              onChange={(event) => setNewCapacity(event.target.value)}
              required
            />
          </label>
        </div>
        <div className="students-form__actions">
          <button className="btn btn--primary" type="submit">
            Adicionar horário
          </button>
        </div>
      </form>
      <div className="segmented segmented--days" role="group" aria-label="Dias da semana">
        {DAYS.map((day) => {
          const on = schedule?.days.includes(day.id) ?? false
          return (
            <button
              key={day.id}
              type="button"
              aria-pressed={on}
              className={on ? 'is-active' : undefined}
              onClick={() => toggleDay(day.id)}
            >
              {day.short}
            </button>
          )
        })}
      </div>
      {(schedule?.days ?? [])
        .filter((day) => (schedule?.slots ?? []).some((slot) => slot.day === day))
        .map((day) => {
        const label = DAYS.find((item) => item.id === day)?.label ?? day
        const slots = schedule?.slots.filter((slot) => slot.day === day) ?? []
        return (
          <section key={day} className="class-day" aria-label={label}>
            <header className="class-day__head">
              <h2>{label}</h2>
            </header>
            <ul className="class-slots">
              {slots.map((slot) => {
                const edit = edits[slot.id] ?? { time: slot.time, capacity: String(slot.capacity) }
                return (
                  <li key={slot.id} className="class-slot class-slot--edit">
                    <label className="students-field">
                      <span>Horário</span>
                      <input
                        className="students-form__input"
                        type="time"
                        value={edit.time}
                        onChange={(event) =>
                          setEdits((current) => ({
                            ...current,
                            [slot.id]: { ...edit, time: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <label className="students-field">
                      <span>Máximo de alunos</span>
                      <input
                        className="students-form__input"
                        type="number"
                        min={1}
                        max={500}
                        value={edit.capacity}
                        onChange={(event) =>
                          setEdits((current) => ({
                            ...current,
                            [slot.id]: { ...edit, capacity: event.target.value },
                          }))
                        }
                      />
                    </label>
                    <button type="button" className="btn" onClick={() => void saveSlot(slot.id)}>
                      Salvar
                    </button>
                    <button
                      type="button"
                      className="btn btn--danger"
                      onClick={() => void removeSlot(slot.id)}
                    >
                      Apagar
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}