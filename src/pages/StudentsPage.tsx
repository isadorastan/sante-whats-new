import { useMemo, useState, type FormEvent } from 'react'
import type { Session, Student, StudentStatus } from '../types'
import { colorForName } from '../types'
import type { StudentInput, StudentUpdate } from '../api/data'
import { brazilToday, formatIsoDate } from '../utils/dates'
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
  status: StudentStatus
  startedOn: string
  endedOn: string
  billingDay: string
  customPrice: boolean
}

const STATUS_LABEL: Record<StudentStatus, string> = {
  ativo: 'Ativo',
  pausado: 'Pausado',
  encerrado: 'Encerrado',
}

const EMPTY_FORM: StudentFormState = {
  name: '',
  phone: '',
  weeklyClasses: '2',
  planValue: '',
  status: 'ativo',
  startedOn: '',
  endedOn: '',
  billingDay: '',
  customPrice: false,
}

function blankForm(): StudentFormState {
  return { ...EMPTY_FORM, startedOn: brazilToday() }
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
    status: student.status,
    startedOn: student.startedOn ?? '',
    endedOn: student.endedOn ?? '',
    billingDay: student.billingDay ? String(student.billingDay) : '',
    customPrice: student.customPrice,
  }
}

function parseOptionalDate(value: string): string | null | undefined {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  return value
}

function parseForm(
  form: StudentFormState,
): Omit<Student, 'id' | 'color'> | null {
  const name = form.name.trim()
  const phone = normalizeBrazilPhone(form.phone)
  const weeklyClasses = Number(form.weeklyClasses)
  const planValue = parseCurrencyInput(form.planValue)
  const startedOn = parseOptionalDate(form.startedOn)
  const endedOn = parseOptionalDate(form.endedOn)
  const billingRaw = form.billingDay.trim()
  const billingDay = billingRaw ? Number(billingRaw) : null

  if (!name) return null
  if (phone.length < 10 || phone.length > 11) return null
  if (!Number.isInteger(weeklyClasses) || weeklyClasses < 1 || weeklyClasses > 7) {
    return null
  }
  if (planValue === null) return null
  if (startedOn === undefined || endedOn === undefined) return null
  if (
    billingDay !== null &&
    (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 28)
  ) {
    return null
  }
  if (form.status === 'encerrado' && !endedOn) return null

  return {
    name,
    phone,
    weeklyClasses,
    planValue,
    status: form.status,
    startedOn,
    endedOn: form.status === 'encerrado' ? endedOn : null,
    billingDay,
    customPrice: form.customPrice,
  }
}

function studentSituation(student: Student): string {
  const bits = [STATUS_LABEL[student.status]]
  if (student.status === 'encerrado' && student.endedOn) {
    bits.push(`saiu em ${formatIsoDate(student.endedOn)}`)
  } else if (student.startedOn) {
    bits.push(`desde ${formatIsoDate(student.startedOn)}`)
  } else {
    bits.push('sem data de início')
  }
  if (student.billingDay) bits.push(`vence dia ${student.billingDay}`)
  else if (student.status === 'ativo') bits.push('sem vencimento')
  if (student.customPrice) bits.push('valor combinado')
  return bits.join(' · ')
}

function StudentFields({
  form,
  onChange,
  autoFocusName,
}: {
  form: StudentFormState
  onChange: <K extends keyof StudentFormState>(
    key: K,
    value: StudentFormState[K],
  ) => void
  autoFocusName?: boolean
}) {
  function changeStatus(status: StudentStatus) {
    onChange('status', status)
    onChange(
      'endedOn',
      status === 'encerrado' ? form.endedOn || brazilToday() : '',
    )
  }

  return (
    <div className="students-form__grid">
      <label className="students-field">
        <span>Nome</span>
        <input
          className="students-form__input"
          type="text"
          value={form.name}
          placeholder="Nome completo"
          autoFocus={autoFocusName}
          onChange={(e) => onChange('name', e.target.value)}
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
          onChange={(e) => onChange('phone', formatPhone(e.target.value))}
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
          onChange={(e) => onChange('weeklyClasses', e.target.value)}
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
          onChange={(e) => onChange('planValue', e.target.value)}
        />
      </label>
      <label className="students-field">
        <span>Situação</span>
        <select
          className="students-form__input"
          value={form.status}
          onChange={(e) => changeStatus(e.target.value as StudentStatus)}
        >
          <option value="ativo">Ativo</option>
          <option value="pausado">Pausado</option>
          <option value="encerrado">Encerrado</option>
        </select>
      </label>
      <label className="students-field">
        <span>Início</span>
        <input
          className="students-form__input"
          type="date"
          value={form.startedOn}
          onChange={(e) => onChange('startedOn', e.target.value)}
        />
      </label>
      <label className="students-field">
        <span>Vencimento</span>
        <input
          className="students-form__input"
          type="number"
          min={1}
          max={28}
          value={form.billingDay}
          placeholder="Dia 1–28"
          onChange={(e) => onChange('billingDay', e.target.value)}
        />
      </label>
      <label className="students-check" title="Fica fora da comparação com a tabela vigente">
        <input
          type="checkbox"
          checked={form.customPrice}
          onChange={(e) => onChange('customPrice', e.target.checked)}
        />
        <span>Valor combinado</span>
      </label>
      {form.status === 'encerrado' ? (
        <label className="students-field">
          <span>Saída</span>
          <input
            className="students-form__input"
            type="date"
            value={form.endedOn}
            onChange={(e) => onChange('endedOn', e.target.value)}
          />
        </label>
      ) : null}
    </div>
  )
}

export function StudentsPage({
  students,
  sessions,
  onCreateStudent,
  onUpdateStudent,
  onDeleteStudent,
}: StudentsPageProps) {
  const [form, setForm] = useState<StudentFormState>(blankForm)
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
      setForm(blankForm())
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
    const aulas =
      count > 0
        ? ` e tira ${count} aula${count === 1 ? '' : 's'} da agenda`
        : ''
    const message = `Remover apaga o aluno${aulas}. O histórico de retenção também some. Para guardar a saída, encerre o aluno na edição. Continuar?`
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
          <StudentFields form={form} onChange={updateForm} />
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
                      <StudentFields
                        form={draft}
                        onChange={updateDraft}
                        autoFocusName
                      />
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
                        <span className="students-list__name">{student.name}</span>
                        <span className="students-list__meta">
                          {formatPhone(student.phone)} · {student.weeklyClasses}x/semana ·{' '}
                          {formatCurrency(student.planValue)}
                        </span>
                        <span className="students-list__meta">
                          {aulas} {aulas === 1 ? 'aula na agenda' : 'aulas na agenda'}
                          {' · '}
                          {studentSituation(student)}
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
