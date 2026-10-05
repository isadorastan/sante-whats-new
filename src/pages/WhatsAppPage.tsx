import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { DayOfWeek, Session, Student } from '../types'
import { DAYS } from '../types'
import { fetchProfessor, saveProfessor } from '../api/professor'
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

const SEND_DELAY_MS = 1000

type SendItemStatus = 'ready' | 'pending' | 'sending' | 'ok' | 'error' | 'cancelled'

interface SendItem {
  id: number
  name: string
  phone: string
  text: string
  time: string
  status: SendItemStatus
  selected: boolean
  error?: string
}

interface WhatsAppPageProps {
  students: Student[]
  sessions: Session[]
}

function selectionLocked(item: SendItem, sending: boolean): boolean {
  return (
    sending ||
    item.status === 'pending' ||
    item.status === 'sending' ||
    item.status === 'ok'
  )
}

function buildMessage(
  name: string,
  dayLabel: string,
  time: string,
  professorName: string,
): string {
  const who = professorName.trim()
    ? `Sua aula com o prof ${professorName.trim()}`
    : 'Sua aula'
  return `Olá, ${name}. ${who} está agendada para ${dayLabel} às ${time}h. Avise se precisar remarcar. Até lá! 👊`
}

function buildQueue(
  sessions: Session[],
  selectedDay: DayOfWeek,
  studentsById: Map<number, Student>,
  dayLabel: string,
  professorName: string,
): SendItem[] {
  return sessions
    .filter((s) => s.day === selectedDay)
    .map((session): SendItem | null => {
      const student = studentsById.get(session.studentId)
      if (!student) return null

      const valid = isValidWhatsAppPhone(student.phone)
      return {
        id: session.id,
        name: student.name,
        phone: toWhatsAppPhone(student.phone),
        time: session.time,
        text: buildMessage(student.name, dayLabel, session.time, professorName),
        selected: true,
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
  const [checking, setChecking] = useState(false)
  const [professorName, setProfessorName] = useState('')
  const [nameDraft, setNameDraft] = useState('')
  const [phoneDraft, setPhoneDraft] = useState('')
  const [savingProfessor, setSavingProfessor] = useState(false)
  const [professorError, setProfessorError] = useState<string | null>(null)
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
    setQueue(
      buildQueue(sessions, selectedDay, studentsById, dayLabel, professorName),
    )
    setBatchDone(false)
  }, [sessions, selectedDay, studentsById, dayLabel, professorName])

  useEffect(() => {
    let alive = true
    fetchProfessor()
      .then((profile) => {
        if (!alive) return
        setProfessorName(profile.name)
        setNameDraft(profile.name)
        setPhoneDraft(profile.phone)
        setProfessorError(null)
      })
      .catch((err) => {
        if (!alive) return
        setProfessorError(
          err instanceof Error
            ? err.message
            : 'Não foi possível carregar os dados do professor',
        )
      })
    return () => {
      alive = false
    }
  }, [])

  async function handleSaveProfessor(event: FormEvent) {
    event.preventDefault()
    setSavingProfessor(true)
    setProfessorError(null)
    try {
      const saved = await saveProfessor({
        name: nameDraft.trim(),
        phone: phoneDraft.trim(),
      })
      setProfessorName(saved.name)
      setNameDraft(saved.name)
      setPhoneDraft(saved.phone)
    } catch (err) {
      setProfessorError(
        err instanceof Error ? err.message : 'Não foi possível salvar',
      )
    } finally {
      setSavingProfessor(false)
    }
  }
  const refreshStatus = useCallback(async () => {
    try {
      const data = await fetchWhatsAppStatus()
      setConnection(data.status)
      setQr(data.qr)
      setStatusError(null)
      return data.status
    } catch {
      setConnection('disconnected')
      setQr(null)
      setStatusError(
        'Servidor WhatsApp offline. Rode npm run dev:server na pasta do projeto',
      )
      return 'disconnected' as const
    }
  }, [])

  const waitingForQr = connection === 'qr' || connection === 'initializing'

  // Consulta ao abrir a página. Repete a cada 2s só enquanto o QR está sendo gerado.
  useEffect(() => {
    let alive = true

    async function poll() {
      if (!alive) return
      await refreshStatus()
    }

    void poll()
    if (!waitingForQr) {
      return () => {
        alive = false
      }
    }

    const timer = window.setInterval(() => void poll(), 2000)
    return () => {
      alive = false
      window.clearInterval(timer)
    }
  }, [waitingForQr, refreshStatus])

  async function handleCheckStatus() {
    setChecking(true)
    try {
      await refreshStatus()
    } finally {
      setChecking(false)
    }
  }

  const summary = useMemo(() => {
    const sent = queue.filter((i) => i.status === 'ok').length
    const failed = queue.filter((i) => i.status === 'error').length
    const cancelled = queue.filter((i) => i.status === 'cancelled').length
    return { sent, failed, cancelled, total: queue.length }
  }, [queue])

  const sendableCount = queue.filter(
    (i) => i.status === 'ready' && i.selected,
  ).length

  function updateItem(id: number, patch: Partial<Pick<SendItem, 'text' | 'selected'>>) {
    setQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )
  }

  const selectableItems = queue.filter((item) => !selectionLocked(item, sending))
  const allSelected =
    selectableItems.length > 0 && selectableItems.every((item) => item.selected)
  const someSelected = selectableItems.some((item) => item.selected)
  const selectAllRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!selectAllRef.current) return
    selectAllRef.current.indeterminate = someSelected && !allSelected
  }, [someSelected, allSelected])

  function toggleAll() {
    const next = !allSelected
    setQueue((prev) =>
      prev.map((item) =>
        selectionLocked(item, sending) ? item : { ...item, selected: next },
      ),
    )
  }

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
        item.status === 'pending' ? { ...item, status: 'cancelled' } : item,
      ),
    )
  }

  async function handleSend() {
    if (sending || sendableCount === 0) return

    const status = await refreshStatus()
    if (status !== 'connected') {
      setStatusError('WhatsApp não está conectado. Verifique a conexão e tente de novo.')
      return
    }

    cancelRef.current = false
    setBatchDone(false)

    const snapshot = queue
      .filter((item) => item.status === 'ready' && item.selected)
      .map((item) => ({ ...item, status: 'pending' as const }))

    if (snapshot.length === 0) return

    setSending(true)
    setQueue((prev) =>
      prev.map((item) =>
        item.status === 'ready' && item.selected
          ? { ...item, status: 'pending' }
          : item,
      ),
    )

    for (let i = 0; i < snapshot.length; i += 1) {
      if (cancelRef.current) {
        setQueue((prev) =>
          prev.map((item) =>
            item.status === 'pending' ? { ...item, status: 'cancelled' } : item,
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
                : item.status === 'pending'
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
            item.status === 'pending' ? { ...item, status: 'cancelled' } : item,
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
        <div className="whatsapp-send__actions">
          {connection === 'connected' || connection === 'disconnected' ? (
            <button
              type="button"
              className="btn"
              disabled={checking || sending}
              onClick={() => void handleCheckStatus()}
            >
              {checking ? 'Verificando...' : 'Verificar conexão'}
            </button>
          ) : null}
          {connection === 'connected' ? (
            <button type="button" className="btn" onClick={() => void handleLogout()}>
              Desconectar
            </button>
          ) : null}
        </div>
      </header>

      <div className="page-body whatsapp-page">
        <section className="whatsapp-card">
          <h2 className="whatsapp-card__title">Dados do professor</h2>
          <p className="whatsapp-card__text">
            O nome entra no aviso dos alunos. O telefone recebe, às 21h, o
            resumo da agenda do dia seguinte.
          </p>
          <form className="students-form" onSubmit={(e) => void handleSaveProfessor(e)}>
            <div className="students-form__grid">
              <label className="students-field">
                <span>Nome</span>
                <input
                  className="students-form__input"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  autoComplete="name"
                />
              </label>
              <label className="students-field">
                <span>WhatsApp</span>
                <input
                  className="students-form__input"
                  value={phoneDraft}
                  onChange={(e) => setPhoneDraft(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="DDD + número"
                />
              </label>
            </div>
            <div className="students-form__actions">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={savingProfessor}
              >
                {savingProfessor ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
          {professorError ? (
            <p className="whatsapp-progress__error">{professorError}</p>
          ) : null}
        </section>

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
              {sendableCount} selecionadas de {summary.total} para {dayLabel}
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
                Prévia · {sendableCount} selecionadas
              </p>
            )}
          </div>

          {queue.length === 0 ? (
            <div className="whatsapp-empty">
              Nenhuma aula neste dia. Escolha outro dia ou marque alunos na
              agenda.
            </div>
          ) : (
            <>
              <label className="whatsapp-progress__select-all">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  disabled={sending || selectableItems.length === 0}
                  onChange={toggleAll}
                  aria-label="Selecionar todas as mensagens"
                />
                Selecionar todas
              </label>
              <ul className="whatsapp-progress__list">
              {queue.map((item) => (
                <li
                  key={item.id}
                  className={`whatsapp-progress__item status-${item.status}${item.selected ? '' : ' is-skipped'}`}
                >
                  <label className="whatsapp-progress__check">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      disabled={selectionLocked(item, sending)}
                      onChange={() =>
                        updateItem(item.id, { selected: !item.selected })
                      }
                      aria-label={`Incluir ${item.name} no envio`}
                    />
                  </label>
                  <div className="whatsapp-progress__main">
                    <span className="whatsapp-progress__name">
                      {item.name}
                      <span className="whatsapp-progress__time">{item.time}</span>
                    </span>
                    <textarea
                      className="whatsapp-progress__text"
                      value={item.text}
                      rows={3}
                      readOnly={selectionLocked(item, sending)}
                      onChange={(e) =>
                        updateItem(item.id, { text: e.target.value })
                      }
                      aria-label={`Mensagem para ${item.name}`}
                    />
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
            </>
          )}
        </section>
      </div>
    </div>
  )
}
