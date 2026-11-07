import { useEffect, useState, type FormEvent } from 'react'
import { ClassActionLoading } from './ClassActionLoading'
import {
  createClassStudent,
  deleteClassStudent,
  fetchClassStudents,
  resetClassStudentPassword,
  updateClassStudent,
} from '../api/class'
import type { ClassStudentAccount } from '../types'

export function ClassStudentsPanel() {
  const [students, setStudents] = useState<ClassStudentAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [crossfit, setCrossfit] = useState(false)
  const [hyrox, setHyrox] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null)
  const [passwordId, setPasswordId] = useState<number | null>(null)
  const [nextPassword, setNextPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null)

  async function reloadStudents() {
    const next = await fetchClassStudents()
    setStudents(next)
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchClassStudents()
      .then((next) => {
        if (!cancelled) {
          setStudents(next)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Falha ao carregar alunos')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function handleCreate(event: FormEvent) {
    event.preventDefault()
    if (!crossfit && !hyrox) {
      setError('Marque Crossfit, Hyrox ou os dois.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createClassStudent({
        name: name.trim(),
        email: email.trim(),
        password,
        crossfit,
        hyrox,
      })
      setName('')
      setEmail('')
      setPassword('')
      setCrossfit(false)
      setHyrox(false)
      await reloadStudents()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao adicionar o aluno')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove(id: number) {
    setRemovingId(id)
    setError(null)
    try {
      await deleteClassStudent(id)
      setConfirmRemoveId(null)
      await reloadStudents()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover o aluno')
    } finally {
      setRemovingId(null)
    }
  }

  async function changeModalities(
    student: ClassStudentAccount,
    next: { crossfit: boolean; hyrox: boolean },
  ) {
    if (!next.crossfit && !next.hyrox) {
      setError('Marque Crossfit, Hyrox ou os dois.')
      return
    }
    setUpdating(true)
    setError(null)
    try {
      await updateClassStudent(student.id, next)
      await reloadStudents()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar o aluno')
    } finally {
      setUpdating(false)
    }
  }

  async function handlePassword(event: FormEvent) {
    event.preventDefault()
    if (passwordId === null) return
    setSaving(true)
    setPasswordMessage(null)
    setError(null)
    try {
      await resetClassStudentPassword(passwordId, nextPassword)
      setNextPassword('')
      setPasswordId(null)
      setPasswordMessage('Senha atualizada. Combine a nova senha com o aluno.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao redefinir a senha')
    } finally {
      setSaving(false)
    }
  }

  const acting = saving || updating || removingId !== null

  return (
    <div className="class-panel">
      {acting ? <ClassActionLoading /> : null}
      <form className="students-form" onSubmit={(event) => void handleCreate(event)}>
        <p className="students-form__label">Adicionar aluno</p>
        {error ? <div className="whatsapp-banner whatsapp-banner--error">{error}</div> : null}
        <div className="class-form-grid">
          <label className="students-field">
            <span>Nome</span>
            <input
              className="students-form__input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <label className="students-field">
            <span>E-mail</span>
            <input
              className="students-form__input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="students-field">
            <span>Senha inicial</span>
            <input
              className="students-form__input"
              type="text"
              autoComplete="new-password"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
        </div>
        <div className="class-checks">
          <label>
            <input
              type="checkbox"
              checked={crossfit}
              onChange={(event) => setCrossfit(event.target.checked)}
            />
            Crossfit
          </label>
          <label>
            <input
              type="checkbox"
              checked={hyrox}
              onChange={(event) => setHyrox(event.target.checked)}
            />
            Hyrox
          </label>
        </div>
        <div className="students-form__actions">
          <button className="btn btn--primary" type="submit" disabled={saving}>
            {saving ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>
      </form>

      {passwordMessage ? <p className="class-note">{passwordMessage}</p> : null}

      {loading ? <p className="page-status">Carregando alunos...</p> : null}
      {!loading && students.length === 0 ? (
        <p className="class-empty">Nenhum aluno de Crossfit ou Hyrox ainda.</p>
      ) : null}
      <ul className="class-roster">
        {students.map((student) => (
          <li key={student.id} className="class-roster__item">
            <div>
              <strong>{student.name}</strong>
              <p>{student.email}</p>
              <div className="class-checks">
                <label>
                  <input
                    type="checkbox"
                    checked={student.crossfit}
                    onChange={(event) =>
                      void changeModalities(student, {
                        crossfit: event.target.checked,
                        hyrox: student.hyrox,
                      })
                    }
                  />
                  Crossfit
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={student.hyrox}
                    onChange={(event) =>
                      void changeModalities(student, {
                        crossfit: student.crossfit,
                        hyrox: event.target.checked,
                      })
                    }
                  />
                  Hyrox
                </label>
              </div>
            </div>
            <div className="class-roster__actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setPasswordId(student.id)
                  setNextPassword('')
                  setPasswordMessage(null)
                }}
              >
                Nova senha
              </button>
              {confirmRemoveId === student.id ? (
                <button
                  type="button"
                  className="btn btn--danger"
                  disabled={removingId === student.id}
                  onClick={() => void handleRemove(student.id)}
                >
                  {removingId === student.id ? 'Removendo...' : 'Confirmar remoção'}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--danger"
                  onClick={() => setConfirmRemoveId(student.id)}
                >
                  Remover
                </button>
              )}
            </div>
            {passwordId === student.id ? (
              <form
                className="class-inline-form"
                onSubmit={(event) => void handlePassword(event)}
              >
                <label className="students-field">
                  <span>Nova senha de {student.name}</span>
                  <input
                    className="students-form__input"
                    type="text"
                    minLength={6}
                    value={nextPassword}
                    onChange={(event) => setNextPassword(event.target.value)}
                    required
                  />
                </label>
                <button className="btn btn--primary" type="submit" disabled={saving}>
                  Salvar senha
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}