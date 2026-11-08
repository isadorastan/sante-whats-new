import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ClassActionLoading } from './ClassActionLoading'
import { WorkoutPresets } from './WorkoutPresets'
import { assistClassWorkout, fetchClassWorkouts, saveClassWorkout } from '../api/class'
import type { ClassModality, ClassWorkoutWeek, DayOfWeek } from '../types'
import { DAYS } from '../types'
import { brazilToday, formatIsoDate } from '../utils/dates'
import { addIsoDays, weekStartMonday } from '../utils/classDates'
import {
  loadWorkoutPresets,
  saveWorkoutPresets,
  type WorkoutPresetGroup,
} from '../utils/workoutPresets'
import { joinWorkout, loadResumos, resumoKey, saveResumos, splitWorkout } from '../utils/workoutResumo'

const MODALITIES: { id: ClassModality; label: string }[] = [
  { id: 'crossfit', label: 'Crossfit' },
  { id: 'hyrox', label: 'Hyrox' },
]

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3.5a2.8 2.8 0 0 0-2.8 2.8v5.4a2.8 2.8 0 0 0 5.6 0V6.3A2.8 2.8 0 0 0 12 3.5z"
      />
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        d="M7 11.2a5 5 0 0 0 10 0M12 16.2V20M8.5 20h7"
      />
    </svg>
  )
}

function dayLabel(day: DayOfWeek): string {
  return DAYS.find((item) => item.id === day)?.label ?? day
}

type SpeechResult = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

type SpeechSession = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechResult) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

function speechRecognition(): SpeechSession | null {
  const host = window as Window & {
    SpeechRecognition?: new () => SpeechSession
    webkitSpeechRecognition?: new () => SpeechSession
  }
  const Recognition = host.SpeechRecognition ?? host.webkitSpeechRecognition
  if (!Recognition) return null
  const session = new Recognition()
  session.lang = 'pt-BR'
  session.continuous = false
  session.interimResults = false
  return session
}

export function ClassWorkoutsPanel() {
  const [modality, setModality] = useState<ClassModality>('crossfit')
  const [weekStart, setWeekStart] = useState(() => weekStartMonday(brazilToday()))
  const [week, setWeek] = useState<ClassWorkoutWeek | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [savedDate, setSavedDate] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [openDate, setOpenDate] = useState<string | null>(null)
  const [presets, setPresets] = useState<WorkoutPresetGroup[]>(loadWorkoutPresets)
  const [resumos, setResumos] = useState<Record<string, string[]>>(loadResumos)
  const [resumoDraft, setResumoDraft] = useState('')
  const [request, setRequest] = useState('')
  const [listening, setListening] = useState(false)
  const [assistError, setAssistError] = useState<string | null>(null)
  const recognitionRef = useRef<SpeechSession | null>(null)

  useEffect(() => {
    return () => recognitionRef.current?.stop()
  }, [openDate])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setSavedDate(null)
    setOpenDate(null)
    void fetchClassWorkouts(modality, weekStart)
      .then((next) => {
        if (cancelled) return
        setWeek(next)
        const nextDrafts: Record<string, string> = {}
        const nextResumos = loadResumos()
        for (const day of next.days) {
          const split = splitWorkout(day.body)
          nextDrafts[day.date] = split.text
          if (split.summary.length > 0) nextResumos[resumoKey(modality, day.date)] = split.summary
        }
        saveResumos(nextResumos)
        setResumos(nextResumos)
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
    setActing(true)
    setError(null)
    setSavedDate(null)
    try {
      const body = joinWorkout(resumos[resumoKey(modality, date)] ?? [], drafts[date] ?? '')
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
    } finally {
      setActing(false)
    }
  }

  function updateResumo(date: string, items: string[]) {
    setResumos((current) => {
      const next = { ...current, [resumoKey(modality, date)]: items }
      saveResumos(next)
      return next
    })
  }

  function addResumo(event: FormEvent, date: string) {
    event.preventDefault()
    const name = resumoDraft.trim()
    if (!name) return
    const items = resumos[resumoKey(modality, date)] ?? []
    const exists = items.some((item) => item.toLowerCase() === name.toLowerCase())
    if (!exists) updateResumo(date, [...items, name])
    setResumoDraft('')
  }

  function updatePresets(next: WorkoutPresetGroup[]) {
    setPresets(next)
    saveWorkoutPresets(next)
  }

  function toggleSpeech() {
    if (listening) {
      recognitionRef.current?.stop()
      return
    }
    const session = speechRecognition()
    if (!session) {
      setAssistError('O microfone não está disponível neste navegador. Digite o pedido.')
      return
    }
    session.onresult = (event) => {
      const last = event.results[event.results.length - 1]
      const transcript = last?.[0]?.transcript?.trim() ?? ''
      if (transcript) setRequest(transcript)
    }
    session.onerror = () => {
      setAssistError('Não foi possível usar o microfone. Digite o pedido.')
      setListening(false)
    }
    session.onend = () => setListening(false)
    recognitionRef.current = session
    setAssistError(null)
    setListening(true)
    try {
      session.start()
    } catch {
      setListening(false)
      setAssistError('Não foi possível usar o microfone. Digite o pedido.')
    }
  }

  async function generate(date: string) {
    const prompt = request.trim()
    if (!prompt) return
    setActing(true)
    setAssistError(null)
    try {
      const text = await assistClassWorkout(prompt)
      setDrafts((current) => ({ ...current, [date]: text }))
    } catch (err) {
      setAssistError(err instanceof Error ? err.message : 'Falha ao gerar o treino')
    } finally {
      setActing(false)
    }
  }

  function insertPreset(date: string, item: string) {
    setDrafts((current) => {
      const text = current[date] ?? ''
      const next = text.trim() ? `${text.replace(/\s+$/, '')}\n${item}` : item
      return { ...current, [date]: next }
    })
  }

  const weekEnd = addIsoDays(weekStart, 6)
  const openDay = (week?.days ?? []).find((day) => day.date === openDate) ?? null

  return (
    <div className="class-panel">
      {acting ? <ClassActionLoading /> : null}
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
              <button
                type="button"
                className="btn"
                aria-expanded={openDate === day.date}
                onClick={() => {
                  setRequest('')
                  setAssistError(null)
                  setOpenDate(day.date)
                }}
              >
                Expandir
              </button>
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
      {openDay ? (
        <div
          className="workout-screen"
          role="dialog"
          aria-modal="true"
          aria-label={`Treino de ${dayLabel(openDay.day)}`}
        >
          <header className="workout-screen__top">
            <div>
              <h2>{dayLabel(openDay.day)}</h2>
              <p>{formatIsoDate(openDay.date)}</p>
            </div>
            <button type="button" className="btn" onClick={() => setOpenDate(null)}>
              Fechar
            </button>
          </header>
          <div className="workout-screen__body">
            <div className="workout-screen__editor">
              <div className="workout-resumo">
                <span className="workout-presets__title">Resumo</span>
                <div className="workout-presets__items">
                  {(resumos[resumoKey(modality, openDay.date)] ?? []).map((item, index) => (
                    <span key={`${item}-${index}`} className="workout-chip">
                      <span className="workout-chip__label">{item}</span>
                      <button
                        type="button"
                        aria-label={`Remover ${item} do resumo`}
                        onClick={() =>
                          updateResumo(
                            openDay.date,
                            (resumos[resumoKey(modality, openDay.date)] ?? []).filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  <form
                    className="workout-presets__add"
                    onSubmit={(event) => addResumo(event, openDay.date)}
                  >
                    <input
                      className="students-form__input"
                      aria-label="Novo item em Resumo"
                      value={resumoDraft}
                      onChange={(event) => setResumoDraft(event.target.value)}
                    />
                    <button className="btn" type="submit">
                      Adicionar
                    </button>
                  </form>
                </div>
              </div>
              <label className="students-field">
                <span>Treino</span>
                <textarea
                  className="students-form__input class-workout-input"
                  rows={16}
                  value={drafts[openDay.date] ?? ''}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [openDay.date]: event.target.value }))
                  }
                />
              </label>
              <div className="workout-assist">
                <label className="students-field">
                  <span>Pedir por escrito</span>
                  <textarea
                    className="students-form__input"
                    rows={3}
                    value={request}
                    onChange={(event) => setRequest(event.target.value)}
                  />
                </label>
                {assistError ? (
                  <div className="whatsapp-banner whatsapp-banner--error">{assistError}</div>
                ) : null}
                <div className="workout-assist__actions">
                  <button
                    type="button"
                    className={`btn workout-assist__mic${listening ? ' is-listening' : ''}`}
                    aria-label={listening ? 'Ouvindo...' : 'Falar'}
                    aria-pressed={listening}
                    onClick={toggleSpeech}
                  >
                    <MicIcon />
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary"
                    disabled={!request.trim() || acting}
                    onClick={() => void generate(openDay.date)}
                  >
                    Gerar treino
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="btn btn--primary class-workout-save"
                onClick={() => void save(openDay.date)}
              >
                {openDay.body.trim() ? 'Salvar treino' : 'Adicionar treino'}
              </button>
              {savedDate === openDay.date ? <p className="class-note">Treino salvo.</p> : null}
            </div>
            <WorkoutPresets
              groups={presets}
              onChange={updatePresets}
              onInsert={(item) => insertPreset(openDay.date, item)}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}