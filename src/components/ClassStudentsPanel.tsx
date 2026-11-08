import { useEffect, useState, type FormEvent } from 'react'
import { ClassActionLoading } from './ClassActionLoading'
import {
  createClassStudent,
  deleteClassStudent,
  fetchClassStudents,
  resendClassStudent,
  updateClassStudent,
} from '../api/class'
import type { ClassStudentAccount } from '../types'

export function ClassStudentsPanel() {
  const [students, setStudents] = useState<ClassStudentAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [crossfit, setCrossfit] = useState(false)
  const [hyrox, setHyrox] = useState(false)
  const [saving, setSaving] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [removingId, setRemovingId] = useState<number | null>(null)
  const [resendingId, setResendingId] = useState<number | null>(null)
  const [confirmRemoveId, setConfirmRemoveId] = useState<number | null>(null)
  const [createdNote, setCreatedNote] = useState<string | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')

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
      const created = await createClassStudent({
        name: name.trim(),
        phone: phone.trim(),
        username: username.trim(),
        password,
        crossfit,
        hyrox,
      })
      setName('')
      setPhone('')
      setUsername('')
      setCrossfit(false)
      setHyrox(false)
      if (created.whatsappSent) {
        setPassword('')
        setCreatedNote('Mensagem enviada no WhatsApp com o link, o usuário e a senha.')
      } else {
        setCreatedNote(
          `Aluno criado. O WhatsApp não enviou a senha: ${created.whatsappError ?? 'falha no envio'}.`,
        )
      }
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

  async function handleEdit(event: FormEvent) {
    event.preventDefault()
    if (editId === null) return
    setUpdating(true)
    setError(null)
    try {
      await updateClassStudent(editId, {
        name: editName.trim(),
        phone: editPhone.trim(),
      })
      setEditId(null)
      await reloadStudents()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar o aluno')
    } finally {
      setUpdating(false)
    }
  }

  async function handleResend(id: number) {
    setResendingId(id)
    setCreatedNote(null)
    setError(null)
    try {
      const result = await resendClassStudent(id)
      if (result.whatsappSent) {
        setCreatedNote('Cadastro reenviado no WhatsApp. A senha anterior foi trocada.')
      } else {
        setCreatedNote(
          `A senha foi trocada, mas o WhatsApp não enviou: ${result.whatsappError ?? 'falha no envio'}. Nova senha: ${result.password ?? ''}`,
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao reenviar o cadastro')
    } finally {
      setResendingId(null)
    }
  }

  const acting = saving || updating || removingId !== null || resendingId !== null

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
            <span>Celular</span>
            <input
              className="students-form__input"
              type="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
          </label>
          <label className="students-field">
            <span>Usuário</span>
            <input
              className="students-form__input"
              autoComplete="off"
              autoCapitalize="none"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
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

      {createdNote ? <p className="class-note">{createdNote}</p> : null}

      {loading ? <p className="page-status">Carregando alunos...</p> : null}
      {!loading && students.length === 0 ? (
        <p className="class-empty">Nenhum aluno de Crossfit ou Hyrox ainda.</p>
      ) : null}
      <ul className="class-roster">
        {students.map((student) => (
          <li key={student.id} className="class-roster__item">
            <div>
              <strong>{student.name}</strong>
              <p>
                {student.username}
                {student.phone ? ` · ${student.phone}` : ''}
              </p>
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
                  setEditId(student.id)
                  setEditName(student.name)
                  setEditPhone(student.phone)
                }}
              >
                Editar
              </button>
              <button
                type="button"
                className="btn"
                disabled={resendingId === student.id}
                onClick={() => void handleResend(student.id)}
              >
                {resendingId === student.id ? 'Enviando...' : 'Reenviar cadastro'}
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
            {editId === student.id ? (
              <form className="class-inline-form" onSubmit={(event) => void handleEdit(event)}>
                <label className="students-field">
                  <span>Nome</span>
                  <input
                    className="students-form__input"
                    value={editName}
                    onChange={(event) => setEditName(event.target.value)}
                    required
                  />
                </label>
                <label className="students-field">
                  <span>Celular</span>
                  <input
                    className="students-form__input"
                    type="tel"
                    value={editPhone}
                    onChange={(event) => setEditPhone(event.target.value)}
                    required
                  />
                </label>
                <button className="btn btn--primary" type="submit" disabled={updating}>
                  Salvar
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}