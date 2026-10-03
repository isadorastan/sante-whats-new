import { useMemo, useState, type FormEvent } from 'react'
import type { Session, Student } from '../types'
import { colorForName } from '../types'
import type { StudentInput, StudentUpdate } from '../api/data'
import {
  digitsOnly,
  formatCurrency,
  formatPhone,
  normalizeBrazilPhone,
  parseCurrencyInput,
} from '../utils/format'

interface StudentsPageProps {
  students: Student[]
  sessions: Session[]
  onCreateStudent: (input: StudentInput) => Promise<Student>
  onUpdateStudent: (id: number, input: StudentUpdate) => Promise<Student>
  onDeleteStudent: (id: number) => Promise<void>
}

interface StudentFormState {
  name: string
  phone: string
  weeklyClasses: string
  planValue: string
}

const EMPTY_FORM: StudentFormState = {
  name: '',
  phone: '',
  weeklyClasses: '2',
  planValue: '',
}

function studentToForm(student: Student): StudentFormState {
  return {
    name: student.name,
    phone: formatPhone(student.phone),
    weeklyClasses: String(student.weeklyClasses),
    planValue: student.planValue.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
  }
}

function parseForm(
  form: StudentFormState,
): Omit<Student, 'id' | 'color'> | null {
  const name = form.name.trim()
  const phone = normalizeBrazilPhone(form.phone)
  const weeklyClasses = Number(form.weeklyClasses)
  const planValue = parseCurrencyInput(form.planValue)

  if (!name) return null
  if (phone.length < 10 || phone.length > 11) return null
  if (!Number.isInteger(weeklyClasses) || weeklyClasses < 1 || weeklyClasses > 7) {
    return null
  }
  if (planValue === null) return null

  return { name, phone, weeklyClasses, planValue }
}

export function StudentsPage({
  students,
  sessions,
  onCreateStudent,
  onUpdateStudent,
  onDeleteStudent,
}: StudentsPageProps) {
  const [form, setForm] = useState<StudentFormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState<StudentFormState>(EMPTY_FORM)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const sessionCountByStudent = useMemo(() => {
    const map = new Map<number, number>()
    for (const session of sessions) {
      map.set(session.studentId, (map.get(session.studentId) ?? 0) + 1)
    }
    return map
  }, [sessions])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = [...students].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR'),
    )
    if (!q) return list

    const qDigits = digitsOnly(q)
    return list.filter((s) => {
      const name = s.name.toLowerCase()
      const phoneFormatted = formatPhone(s.phone).toLowerCase()
      const phoneDigits = digitsOnly(s.phone)
      return (
        name.includes(q) ||
        phoneFormatted.includes(q) ||
        (qDigits.length > 0 && phoneDigits.includes(qDigits))
      )
    })
  }, [students, query])

  function updateForm<K extends keyof StudentFormState>(
    key: K,
    value: StudentFormState[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function updateDraft<K extends keyof StudentFormState>(
    key: K,
    value: StudentFormState[K],
  ) {
    setDraft((prev) => ({ ...prev, [key]: value }))
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    const parsed = parseForm(form)
    if (!parsed || busy) return

    setBusy(true)
    setFormError(null)
    try {
      await onCreateStudent({
        ...parsed,
        color: colorForName(parsed.name),
      })
      setForm(EMPTY_FORM)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao criar aluno')
    } finally {
      setBusy(false)
    }
  }

  function startEdit(student: Student) {
    setEditingId(student.id)
    setDraft(studentToForm(student))
    setFormError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(EMPTY_FORM)
  }

  async function saveEdit(studentId: number) {
    const parsed = parseForm(draft)
    if (!parsed || busy) return

    setBusy(true)
    setFormError(null)
    try {
      await onUpdateStudent(studentId, parsed)
      cancelEdit()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao salvar aluno')
    } finally {
      setBusy(false)
    }
  }

  async function removeStudent(studentId: number) {
    const count = sessionCountByStudent.get(studentId) ?? 0
    const message =
      count > 0
        ? `Remover este aluno também tira ${count} aula${count === 1 ? '' : 's'} da agenda. Continuar?`
        : 'Remover este aluno do cadastro?'
    if (!window.confirm(message)) return

    setBusy(true)
    setFormError(null)
    try {
      await onDeleteStudent(studentId)
      if (editingId === studentId) cancelEdit()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Falha ao remover aluno')
    } finally {
      setBusy(false)
    }
  }

  const canCreate = parseForm(form) !== null && !busy

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Alunos</h1>
          <p className="page-header__subtitle">
            Cadastre alunos para usá-los na agenda semanal
          </p>
        </div>
      </header>

      <div className="page-body students-page">
        {formError ? (
          <div className="whatsapp-banner whatsapp-banner--error">{formError}</div>
        ) : null}

        <form className="students-form" onSubmit={(e) => void handleCreate(e)}>
          <p className="students-form__label">Novo aluno</p>
          <div className="students-form__grid">
            <label className="students-field">
              <span>Nome</span>
              <input
                className="students-form__input"
                type="text"
                value={form.name}
                placeholder="Nome completo"
                onChange={(e) => updateForm('name', e.target.value)}
              />
            </label>
            <label className="students-field">
              <span>Telefone</span>
              <input
                className="students-form__input"
                type="tel"
                inputMode="numeric"
                value={form.phone}
                placeholder="(11) 98765-4321"
                onChange={(e) => updateForm('phone', formatPhone(e.target.value))}
              />
            </label>
            <label className="students-field">
              <span>Vezes na semana</span>
              <input
                className="students-form__input"
                type="number"
                min={1}
                max={7}
                value={form.weeklyClasses}
                onChange={(e) => updateForm('weeklyClasses', e.target.value)}
              />
            </label>
            <label className="students-field">
              <span>Valor do plano</span>
              <input
                className="students-form__input"
                type="text"
                inputMode="decimal"
                value={form.planValue}
                placeholder="450,00"
                onChange={(e) => updateForm('planValue', e.target.value)}
              />
            </label>
          </div>
          <div className="students-form__actions">
            <button type="submit" className="btn btn--primary" disabled={!canCreate}>
              Adicionar aluno
            </button>
          </div>
        </form>

        <div className="students-toolbar">
          <input
            className="students-form__input"
            type="search"
            value={query}
            placeholder="Buscar por nome ou telefone..."
            aria-label="Buscar aluno"
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="students-toolbar__count">
            {filtered.length} de {students.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="students-empty">
            {students.length === 0
              ? 'Nenhum aluno cadastrado ainda.'
              : 'Nenhum aluno encontrado com essa busca.'}
          </div>
        ) : (
          <ul className="students-list">
            {filtered.map((student) => {
              const aulas = sessionCountByStudent.get(student.id) ?? 0
              const isEditing = editingId === student.id

              return (
                <li key={student.id} className="students-list__item">
                  <span
                    className="students-list__swatch"
                    style={{ background: student.color }}
                    aria-hidden
                  />

                  {isEditing ? (
                    <form
                      className="students-list__edit"
                      onSubmit={(e) => {
                        e.preventDefault()
                        void saveEdit(student.id)
                      }}
                    >
                      <div className="students-form__grid">
                        <label className="students-field">
                          <span>Nome</span>
                          <input
                            className="students-form__input"
                            value={draft.name}
                            autoFocus
                            onChange={(e) => updateDraft('name', e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') cancelEdit()
                            }}
                          />
                        </label>
                        <label className="students-field">
                          <span>Telefone</span>
                          <input
                            className="students-form__input"
                            type="tel"
                            value={draft.phone}
                            onChange={(e) =>
                              updateDraft('phone', formatPhone(e.target.value))
                            }
                          />
                        </label>
                        <label className="students-field">
                          <span>Vezes na semana</span>
                          <input
                            className="students-form__input"
                            type="number"
                            min={1}
                            max={7}
                            value={draft.weeklyClasses}
                            onChange={(e) =>
                              updateDraft('weeklyClasses', e.target.value)
                            }
                          />
                        </label>
                        <label className="students-field">
                          <span>Valor do plano</span>
                          <input
                            className="students-form__input"
                            type="text"
                            inputMode="decimal"
                            value={draft.planValue}
                            onChange={(e) => updateDraft('planValue', e.target.value)}
                          />
                        </label>
                      </div>
                      <div className="students-form__actions">
                        <button
                          type="submit"
                          className="btn btn--primary"
                          disabled={parseForm(draft) === null || busy}
                        >
                          Salvar
                        </button>
                        <button type="button" className="btn" onClick={cancelEdit}>
                          Cancelar
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="students-list__info">
                        <span className="students-list__name">{student.name}</span>                        <span className="students-list__meta">
                          {formatPhone(student.phone)} · {student.weeklyClasses}x/semana ·{' '}
                          {formatCurrency(student.planValue)}
                        </span>
                        <span className="students-list__meta">
                          {aulas} {aulas === 1 ? 'aula na agenda' : 'aulas na agenda'}
                        </span>
                      </div>
                      <div className="students-list__actions">
                        <button
                          type="button"
                          className="btn"
                          disabled={busy}
                          onClick={() => startEdit(student)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn btn--danger"
                          disabled={busy}
                          onClick={() => void removeStudent(student.id)}
                        >
                          Remover
                        </button>
                      </div>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
