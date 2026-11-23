import { useEffect, useState } from 'react'
import { acceptClassInvite, createClassInvites, declineClassInvite } from '../api/class'
import type { ClassInvite, ClassInvites as ClassInvitesData, ClassModality, DayOfWeek } from '../types'
import { DAYS } from '../types'
import { brazilToday } from '../utils/dates'

/** Convites só no Crossfit por enquanto. Inclua 'hyrox' para liberar. */
export const INVITE_MODALITIES: readonly ClassModality[] = ['crossfit', 'hyrox']

export function invitesEnabled(modality: ClassModality): boolean {
  return INVITE_MODALITIES.includes(modality)
}

interface SlotInvitesProps {
  slotId: number
  date: string
  day: DayOfWeek
  time: string
  modality: ClassModality
  invites: ClassInvitesData | null
  focused?: boolean
  onChanged: () => void
}

function dayShort(day: DayOfWeek): string {
  return DAYS.find((item) => item.id === day)?.short ?? day
}

function modalityLabel(modality: ClassModality): string {
  return modality === 'hyrox' ? 'Hyrox' : 'Crossfit'
}

function whenLabel(day: DayOfWeek, date: string, time: string): string {
  const [, month, dayNumber] = date.split('-')
  return `${dayShort(day)} ${dayNumber}/${month} ${time}`
}

function classLabel(day: DayOfWeek, date: string, time: string, modality: ClassModality): string {
  return `${modalityLabel(modality)} - ${whenLabel(day, date, time)}`
}

const STUDENT_APP_URL = 'https://ctfsante.com.br/aluno'

export function inviteWhatsAppUrl(invite: Pick<ClassInvite, 'day' | 'classOn' | 'time' | 'modality' | 'toName'>): string {
  const text = [
    `Oi ${invite.toName}! Te convidei para treinar comigo na Santé!`,
    classLabel(invite.day, invite.classOn, invite.time, invite.modality),
    '',
    `Aceita no app: ${STUDENT_APP_URL}`,
  ].join('\n')
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

function WhatsAppMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.52 3.48A11.86 11.86 0 0 0 12.06 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.6 5.95L0 24l6.3-1.65a11.9 11.9 0 0 0 5.76 1.47h.01c6.55 0 11.89-5.33 11.89-11.89 0-3.18-1.24-6.16-3.44-8.45zM12.07 21.8h-.01a9.86 9.86 0 0 1-5.02-1.38l-.36-.21-3.74.98 1-3.64-.23-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.89 9.9-9.89 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.91 9.88zm5.42-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.78-1.47-1.75-1.64-2.05-.17-.3-.02-.46.13-.6.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z"
      />
    </svg>
  )
}

function statusLabel(status: ClassInvite['status']): string {
  if (status === 'accepted') return 'Aceito'
  if (status === 'declined') return 'Recusou'
  return 'Pendente'
}

interface InviteRow {
  invite: ClassInvite
  direction: 'sent' | 'received'
}

function inviteTitle(row: InviteRow): string {
  if (row.direction === 'sent') return `Você convidou ${row.invite.toName}`
  return `${row.invite.fromName} convidou você`
}

export function SlotInvites({
  slotId,
  date,
  day,
  time,
  modality,
  invites,
  focused = false,
  onChanged,
}: SlotInvitesProps) {
  const [open, setOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [picked, setPicked] = useState<number[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [answerError, setAnswerError] = useState<number | null>(null)
  const [answerMessage, setAnswerMessage] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const rows: InviteRow[] = [
    ...(invites?.sent ?? [])
      .filter((invite) => invite.slotId === slotId && invite.classOn === date && invite.modality === modality)
      .map((invite) => ({ invite, direction: 'sent' as const })),
    ...(invites?.received ?? [])
      .filter((invite) => invite.slotId === slotId && invite.classOn === date && invite.modality === modality)
      .map((invite) => ({ invite, direction: 'received' as const })),
  ].sort((a, b) => a.invite.id - b.invite.id)
  const classmates = (invites?.classmates ?? []).filter((person) =>
    modality === 'crossfit' ? person.crossfit : person.hyrox,
  )
  const confirming = rows.find((row) => row.invite.id === confirmId) ?? null

  useEffect(() => {
    if (!focused) return
    document.getElementById(`slot-invites-${slotId}-${date}`)?.scrollIntoView?.({
      behavior: 'smooth',
      block: 'start',
    })
  }, [focused, slotId, date, rows.length])

  useEffect(() => {
    if (!open && confirmId == null) return
    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      if (confirmId != null) setConfirmId(null)
      else setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, confirmId])

  async function send() {
    if (picked.length === 0) return
    setSending(true)
    setFormError(null)
    try {
      await createClassInvites({ modality, slotId, date, studentIds: picked })
      setPicked([])
      setOpen(false)
      onChanged()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao enviar o convite')
    } finally {
      setSending(false)
    }
  }

  function shareOnWhatsApp(invite: ClassInvite) {
    window.open(inviteWhatsAppUrl(invite), '_blank', 'noopener,noreferrer')
  }

  async function answer(id: number, accept: boolean) {
    setBusyId(id)
    setAnswerError(null)
    setAnswerMessage(null)
    try {
      if (accept) await acceptClassInvite(id)
      else await declineClassInvite(id)
      onChanged()
      return true
    } catch (err) {
      setAnswerError(id)
      setAnswerMessage(err instanceof Error ? err.message : 'Falha ao responder o convite')
      return false
    } finally {
      setBusyId(null)
    }
  }

  async function confirmAccept() {
    if (confirmId == null) return
    const ok = await answer(confirmId, true)
    if (ok) setConfirmId(null)
  }

  return (
    <div className="class-slot__invites" id={`slot-invites-${slotId}-${date}`}>
      <div className="class-slot__invites-head">
        <p className="class-slot__label">Convites</p>
        <button
          type="button"
          className="btn class-slot__invite-btn"
          onClick={() => {
            setPicked([])
            setFormError(null)
            setOpen(true)
          }}
        >
          Convidar amigo
        </button>
      </div>
      <p className="class-slot__invite-note">Chame um amigo pra treinar com você</p>
      {rows.length > 0 ? (
        <ul className="class-invite-list">
          {rows.map((row) => {
            const pending = row.direction === 'received' && row.invite.status === 'pending'
            const canShare = row.direction === 'sent' && row.invite.status === 'pending'
            const upcoming = row.invite.classOn >= brazilToday()
            const canUndo = row.direction === 'received' && row.invite.status === 'declined' && upcoming
            const canLeave = row.direction === 'received' && row.invite.status === 'accepted' && upcoming
            return (
              <li
                key={row.invite.id}
                className={
                  row.invite.status === 'accepted'
                    ? 'is-accepted'
                    : row.invite.status === 'declined'
                      ? 'is-declined'
                      : undefined
                }
              >
                <div>
                  <strong>{inviteTitle(row)}</strong>
                  <span>{classLabel(row.invite.day, row.invite.classOn, row.invite.time, row.invite.modality)}</span>
                </div>
                {pending || canUndo || canLeave ? (
                  <div className="class-invite-actions">
                    {canUndo ? <span className="class-invite-status is-declined">Recusou</span> : null}
                    {canLeave ? <span className="class-invite-status is-accepted">Aceito</span> : null}
                    {pending || canUndo ? (
                      <button
                        type="button"
                        className="btn class-invite-quiet class-invite-accept"
                        disabled={busyId === row.invite.id}
                        onClick={() => setConfirmId(row.invite.id)}
                      >
                        Aceitar
                      </button>
                    ) : null}
                    {pending || canLeave ? (
                      <button
                        type="button"
                        className="btn class-invite-quiet class-invite-decline"
                        disabled={busyId === row.invite.id}
                        onClick={() => void answer(row.invite.id, false)}
                      >
                        Recusar
                      </button>
                    ) : null}
                  </div>
                ) : canShare ? (
                  <div className="class-invite-actions">
                    <span className="class-invite-status">Pendente</span>
                    <button
                      type="button"
                      className="class-invite-whatsapp"
                      aria-label={`Enviar convite para ${row.invite.toName} no WhatsApp`}
                      onClick={() => shareOnWhatsApp(row.invite)}
                    >
                      <WhatsAppMark />
                    </button>
                  </div>
                ) : (
                  <span className={`class-invite-status is-${row.invite.status}`}>{statusLabel(row.invite.status)}</span>
                )}
                {answerError === row.invite.id && answerMessage ? (
                  <p className="class-invite-error">{answerMessage}</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}
      {open ? (
        <div className="class-share-modal class-invite-modal" role="dialog" aria-modal="true" aria-labelledby={`invite-${slotId}-${date}`}>
          <div className="class-share-modal__backdrop" onClick={() => setOpen(false)} />
          <div className="class-share-modal__card">
            <header className="class-share-modal__top">
              <h2 id={`invite-${slotId}-${date}`}>Convidar amigo</h2>
              <button type="button" className="btn" onClick={() => setOpen(false)}>
                Fechar
              </button>
            </header>
            {formError ? <div className="whatsapp-banner whatsapp-banner--error">{formError}</div> : null}
            <p className="class-slot__invite-note">{classLabel(day, date, time, modality)}</p>
            {classmates.length === 0 ? (
              <p className="class-empty">Nenhum colega nessa modalidade.</p>
            ) : (
              <ul className="class-invite-people">
                {classmates.map((person) => {
                  const selected = picked.includes(person.id)
                  return (
                    <li key={person.id}>
                      <label>
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() =>
                            setPicked((currentIds) =>
                              selected ? currentIds.filter((id) => id !== person.id) : [...currentIds, person.id],
                            )
                          }
                        />
                        {person.name}
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            <button
              type="button"
              className="btn btn--primary"
              disabled={picked.length === 0 || sending}
              onClick={() => void send()}
            >
              {sending ? 'Enviando...' : 'Convidar'}
            </button>
          </div>
        </div>
      ) : null}
      {confirming ? (
        <div
          className="class-share-modal class-invite-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="class-invite-confirm-title"
        >
          <div className="class-share-modal__backdrop" onClick={() => setConfirmId(null)} />
          <div className="class-share-modal__card class-invite-confirm">
            <h2 id="class-invite-confirm-title">Confirmar check-in</h2>
            <p>Seu check-in será feito automaticamente nessa aula.</p>
            <p>{classLabel(confirming.invite.day, confirming.invite.classOn, confirming.invite.time, confirming.invite.modality)}</p>
            {answerError === confirming.invite.id && answerMessage ? (
              <p className="class-invite-error">{answerMessage}</p>
            ) : null}
            <div className="class-invite-confirm__actions">
              <button type="button" className="btn" onClick={() => setConfirmId(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busyId === confirming.invite.id}
                onClick={() => void confirmAccept()}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
