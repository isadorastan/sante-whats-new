import { useEffect, useMemo, useRef, useState } from 'react'
import type { DayOfWeek, Session, Student } from '../types'
import { DAYS } from '../types'
import {
  fetchWhatsAppStatus,
  isValidWhatsAppPhone,
  logoutWhatsApp,
  sendWhatsAppOne,
  sleep,
  startWhatsApp,
  toWhatsAppPhone,
  type WhatsAppConnectionStatus,
} from '../api/whatsapp'

const PROFESSOR_NAME = 'Jean'
const SEND_DELAY_MS = 1000

type SendItemStatus = 'ready' | 'pending' | 'sending' | 'ok' | 'error' | 'cancelled'

interface SendItem {
  id: number
  name: string
  phone: string
  text: string
  time: string
  status: SendItemStatus
  error?: string
}

interface WhatsAppPageProps {
  students: Student[]
  sessions: Session[]
}

function buildMessage(name: string, dayLabel: string, time: string): string {
  return `Olá, ${name}. Sua aula com o prof ${PROFESSOR_NAME} está agendada para ${dayLabel} ${time}. É a isa testando, ignore`
}

function buildQueue(
  sessions: Session[],
  selectedDay: DayOfWeek,
  studentsById: Map<number, Student>,
  dayLabel: string,
): SendItem[] {
  return sessions
    .filter((s) => s.day === selectedDay)
    .map((session) => {
      const student = studentsById.get(session.studentId)
      if (!student) return null

      const valid = isValidWhatsAppPhone(student.phone)
      return {
        id: session.id,
        name: student.name,
        phone: toWhatsAppPhone(student.phone),
        time: session.time,
        text: buildMessage(student.name, dayLabel, session.time),
        status: valid ? ('ready' as const) : ('error' as const),
        error: valid
          ? undefined
          : 'Telefone incompleto — edite o aluno (DDD + número)',
      }
    })
    .filter((item): item is SendItem => item !== null)
    .sort(
      (a, b) =>
        a.time.localeCompare(b.time) || a.name.localeCompare(b.name, 'pt-BR'),
    )
}

export function WhatsAppPage({ students, sessions }: WhatsAppPageProps) {
  const [connection, setConnection] =
    useState<WhatsAppConnectionStatus>('disconnected')
  const [qr, setQr] = useState<string | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>('ter')
  const [queue, setQueue] = useState<SendItem[]>([])
  const [sending, setSending] = useState(false)
  const [batchDone, setBatchDone] = useState(false)
  const cancelRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const sendingRef = useRef(false)
  sendingRef.current = sending

  const studentsById = useMemo(() => {
    const map = new Map<number, Student>()
    for (const student of students) map.set(student.id, student)
    return map
  }, [students])

  const dayLabel = DAYS.find((d) => d.id === selectedDay)?.label ?? selectedDay

  // Remonta a prévia só quando dia/dados mudam — não ao terminar o envio,
  // senão o ✓ de sucesso some na hora.
  useEffect(() => {
    if (sendingRef.current) return
    setQueue(buildQueue(sessions, selectedDay, studentsById, dayLabel))
    setBatchDone(false)
  }, [sessions, selectedDay, studentsById, dayLabel])
  useEffect(() => {
    let alive = true

    async function poll() {
      try {
        const data = await fetchWhatsAppStatus()
        if (!alive) return
        setConnection(data.status)
        setQr(data.qr)
        setStatusError(null)
      } catch {
        if (!alive) return
        setConnection('disconnected')
        setQr(null)
        setStatusError(
          'Servidor WhatsApp offline. Rode npm run dev:server na pasta do projeto',
        )
      }
    }

    void poll()
    const timer = window.setInterval(poll, 2000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [])

  const summary = useMemo(() => {
    const sent = queue.filter((i) => i.status === 'ok').length
    const failed = queue.filter((i) => i.status === 'error').length
    const cancelled = queue.filter((i) => i.status === 'cancelled').length
    const ready = queue.filter((i) => i.status === 'ready' || i.status === 'pending')
      .length
    return { sent, failed, cancelled, ready, total: queue.length }
  }, [queue])

  const sendableCount = queue.filter((i) => i.status === 'ready').length

  async function handleLogout() {
    try {
      await logoutWhatsApp()
      setConnection('initializing')
      setQr(null)
    } catch {
      setStatusError('Não foi possível desconectar')
    }
  }

  async function handleReconnect() {
    try {
      setConnection('initializing')
      setQr(null)
      setStatusError(null)
      await startWhatsApp()
    } catch {
      setStatusError('Não foi possível reiniciar a conexão')
    }
  }

  function handleCancel() {
    cancelRef.current = true
    abortRef.current?.abort()
    setQueue((prev) =>
      prev.map((item) =>
        item.status === 'pending' || item.status === 'ready'
          ? { ...item, status: 'cancelled' }
          : item,
      ),
    )
  }

  async function handleSend() {
    if (sending || connection !== 'connected' || sendableCount === 0) return

    cancelRef.current = false
    setBatchDone(false)

    const snapshot = queue
      .filter((item) => item.status === 'ready')
      .map((item) => ({ ...item, status: 'pending' as const }))

    if (snapshot.length === 0) return

    setSending(true)
    setQueue((prev) =>
      prev.map((item) =>
        item.status === 'ready' ? { ...item, status: 'pending' } : item,
      ),
    )

    for (let i = 0; i < snapshot.length; i += 1) {
      if (cancelRef.current) {
        setQueue((prev) =>
          prev.map((item) =>
            item.status === 'pending' || item.status === 'ready'
              ? { ...item, status: 'cancelled' }
              : item,
          ),
        )
        break
      }

      const current = snapshot[i]

      setQueue((prev) =>
        prev.map((item) =>
          item.id === current.id ? { ...item, status: 'sending' } : item,
        ),
      )

      const controller = new AbortController()
      abortRef.current = controller

      try {
        const result = await sendWhatsAppOne(
          {
            phone: current.phone,
            text: current.text,
            name: current.name,
          },
          controller.signal,
        )

        setQueue((prev) =>
          prev.map((item) =>
            item.id === current.id
              ? result.ok
                ? { ...item, status: 'ok', error: undefined }
                : {
                    ...item,
                    status: 'error',
                    error: result.error ?? 'Falha ao enviar',
                  }
              : item,
          ),
        )
      } catch (err) {
        if (controller.signal.aborted || cancelRef.current) {
          setQueue((prev) =>
            prev.map((item) =>
              item.id === current.id && item.status === 'sending'
                ? { ...item, status: 'cancelled' }
                : item.status === 'pending' || item.status === 'ready'
                  ? { ...item, status: 'cancelled' }
                  : item,
            ),
          )
          break
        }

        const message = err instanceof Error ? err.message : 'Falha ao enviar'
        setQueue((prev) =>
          prev.map((item) =>
            item.id === current.id
              ? { ...item, status: 'error', error: message }
              : item,
          ),
        )
      }

      if (cancelRef.current) {
        setQueue((prev) =>
          prev.map((item) =>
            item.status === 'pending' || item.status === 'ready'
              ? { ...item, status: 'cancelled' }
              : item,
          ),
        )
        break
      }

      if (i < snapshot.length - 1) {
        await sleep(SEND_DELAY_MS)
      }
    }

    abortRef.current = null
    setSending(false)
    setBatchDone(true)
  }

  const canSend =
    connection === 'connected' && !sending && sendableCount > 0

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">WhatsApp</h1>
          <p className="page-header__subtitle">
            Conecte o WhatsApp e avise os alunos do dia
          </p>
        </div>
        {connection === 'connected' ? (
          <button type="button" className="btn" onClick={() => void handleLogout()}>
            Desconectar
          </button>
        ) : null}
      </header>

      <div className="page-body whatsapp-page">
        {statusError ? (
          <div className="whatsapp-banner whatsapp-banner--error">{statusError}</div>
        ) : null}

        {connection !== 'connected' ? (
          <section className="whatsapp-card">
            <h2 className="whatsapp-card__title">Conectar WhatsApp</h2>
            <p className="whatsapp-card__text">
              Abra o WhatsApp no celular → Aparelhos conectados → Conectar um
              aparelho e escaneie o QR code.
            </p>
            <div className="whatsapp-qr">
              {qr ? (
                <img
                  src={qr}
                  alt="QR Code do WhatsApp"
                  className="whatsapp-qr__image"
                />
              ) : (
                <div className="whatsapp-qr__loading">
                  <span className="spinner" aria-hidden />
                  {connection === 'initializing'
                    ? 'Abrindo WhatsApp Web...'
                    : connection === 'qr'
                      ? 'Gerando QR code...'
                      : 'Aguardando conexão...'}
                </div>
              )}
            </div>
            {connection === 'disconnected' ? (
              <div className="whatsapp-send__actions">
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => void handleReconnect()}
                >
                  Gerar QR novamente
                </button>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="whatsapp-card">
            <div className="whatsapp-connected">
              <span className="whatsapp-connected__dot" aria-hidden />
              WhatsApp conectado
            </div>
          </section>
        )}

        <section className="whatsapp-card">
          <div className="whatsapp-send">
            <label className="students-field">
              <span>Dia da semana</span>
              <select
                className="students-form__input"
                value={selectedDay}
                disabled={sending}
                onChange={(e) => setSelectedDay(e.target.value as DayOfWeek)}
              >
                {DAYS.map((day) => (
                  <option key={day.id} value={day.id}>
                    {day.label}
                  </option>
                ))}
              </select>
            </label>

            <p className="whatsapp-send__count">
              {summary.total}{' '}
              {summary.total === 1 ? 'mensagem' : 'mensagens'} para {dayLabel}
            </p>

            <div className="whatsapp-send__actions">
              <button
                type="button"
                className="btn btn--primary"
                disabled={!canSend}
                onClick={() => void handleSend()}
              >
                Enviar agora
              </button>
              {sending ? (
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={handleCancel}
                >
                  Cancelar envio
                </button>
              ) : null}
            </div>

            {connection !== 'connected' ? (
              <p className="whatsapp-card__text">
                Conecte o WhatsApp acima para liberar o envio.
              </p>
            ) : null}
          </div>
        </section>

        <section className="whatsapp-card whatsapp-progress">
          <div className="whatsapp-progress__header">
            <h2 className="whatsapp-card__title">Envio — {dayLabel}</h2>
            {sending ? (
              <p className="whatsapp-progress__summary">Enviando...</p>
            ) : batchDone ? (
              <p className="whatsapp-progress__summary">
                {summary.sent} enviadas · {summary.failed} com erro ·{' '}
                {summary.cancelled} canceladas
              </p>
            ) : (
              <p className="whatsapp-progress__summary">
                Prévia · {summary.ready} prontas
              </p>
            )}
          </div>

          {queue.length === 0 ? (
            <div className="whatsapp-empty">
              Nenhuma aula neste dia. Escolha outro dia ou marque alunos na
              agenda.
            </div>
          ) : (
            <ul className="whatsapp-progress__list">
              {queue.map((item) => (
                <li
                  key={item.id}
                  className={`whatsapp-progress__item status-${item.status}`}
                >
                  <div className="whatsapp-progress__main">
                    <span className="whatsapp-progress__name">
                      {item.name}
                      <span className="whatsapp-progress__time">{item.time}</span>
                    </span>
                    <p className="whatsapp-progress__preview">{item.text}</p>
                    {item.status === 'error' && item.error ? (
                      <span className="whatsapp-progress__error">{item.error}</span>
                    ) : null}
                    {item.status === 'cancelled' ? (
                      <span className="whatsapp-progress__error">cancelado</span>
                    ) : null}
                  </div>
                  <span
                    className="whatsapp-progress__icon"
                    aria-label={item.status}
                  >
                    {item.status === 'ready' ? '○' : null}
                    {item.status === 'pending' ? '…' : null}
                    {item.status === 'sending' ? (
                      <span className="spinner" />
                    ) : null}
                    {item.status === 'ok' ? '✓' : null}
                    {item.status === 'error' ? '!' : null}
                    {item.status === 'cancelled' ? '–' : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
