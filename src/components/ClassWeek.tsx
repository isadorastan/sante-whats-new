import { useEffect, useId, useState, type FormEvent } from 'react'
import { invitesEnabled, SlotInvites } from './ClassInvites'
import type { ClassInvites, ClassModality, ClassWeek as ClassWeekData, DayOfWeek } from '../types'
import { DAYS } from '../types'
import { formatIsoDate } from '../utils/dates'
import { addIsoDays, weekStartMonday } from '../utils/classDates'
import { downloadShareSticker, stickerContent, stickerFilename } from '../utils/shareSticker'
import { splitWorkout } from '../utils/workoutResumo'

const SHOW_SHARE_STICKER = false

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

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect
        x="3.5"
        y="5"
        width="17"
        height="14"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="8.5" cy="9.5" r="1.3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4.2 16.2l4.1-3.2 2.8 2.2 2.5-2L19.8 17"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShareSticker({
  time,
  date,
  chips,
}: {
  time: string
  date: string
  chips: string[]
}) {
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [minutes, setMinutes] = useState('')
  const parsed = /^\d+$/.test(minutes.trim()) ? Number(minutes.trim()) : 0
  const content = stickerContent({ time, minutes: parsed, chips })

  useEffect(() => {
    if (!open) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function download(event: FormEvent) {
    event.preventDefault()
    if (!content) return
    void downloadShareSticker(content, stickerFilename(date))
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className="btn class-share-icon"
        aria-label="Baixar figurinha"
        onClick={() => setOpen(true)}
      >
        <ImageIcon />
      </button>
      {open ? (
        <div className="class-share-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <div className="class-share-modal__backdrop" onClick={() => setOpen(false)} />
          <form className="class-share-modal__card" onSubmit={download}>
            <header className="class-share-modal__top">
              <h2 id={titleId}>Figurinha</h2>
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                Fechar
              </button>
            </header>
            <label className="students-field">
              <span>Tempo (minutos)</span>
              <input
                className="students-form__input"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={minutes}
                onChange={(event) => setMinutes(event.target.value)}
              />
            </label>
            <button type="submit" className="btn btn--primary" disabled={!content}>
              Baixar
            </button>
          </form>
        </div>
      ) : null}
    </>
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
  invites?: ClassInvites | null
  onInvitesChanged?: () => void
  focusInvite?: { slotId: number; date: string } | null
}

export function ClassWeek({
  week,
  modality,
  onModality,
  onShiftWeek,
  onCheckIn,
  onCancel,
  busyId,
  invites = null,
  onInvitesChanged = () => {},
  focusInvite = null,
}: ClassWeekProps) {
  const visible = MODALITIES.filter((item) => week.modalities[item.id])
  const current = visible.some((item) => item.id === modality) ? modality : visible[0]?.id
  const days = (current ? (week.modalities[current]?.days ?? []) : []).filter(
    (day) => day.slots.length > 0 || day.workout.trim().length > 0,
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
            const checkedSlot = day.slots.find((slot) => slot.myCheckinId)
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
                {hasWorkout || (SHOW_SHARE_STICKER && checkedSlot) ? (
                  <div className="class-day__tools">
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
                    ) : null}
                    {SHOW_SHARE_STICKER && checkedSlot ? (
                      <ShareSticker time={checkedSlot.time} date={day.date} chips={summary} />
                    ) : null}
                  </div>
                ) : summary.length === 0 ? (
                  <p className="class-workout">Treino ainda não saiu.</p>
                ) : null}
                {workoutOpen && hasWorkout ? <p className="class-workout">{text}</p> : null}
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
                          {current && invitesEnabled(current) ? (
                            <SlotInvites
                              slotId={slot.id}
                              date={day.date}
                              day={day.day}
                              time={slot.time}
                              modality={current}
                              invites={invites}
                              focused={focusInvite?.slotId === slot.id && focusInvite.date === day.date}
                              onChanged={onInvitesChanged}
                            />
                          ) : null}
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