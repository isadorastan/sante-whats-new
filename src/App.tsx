import { useCallback, useEffect, useState } from 'react'
import type { AppPage, DayOfWeek, Session, Student } from './types'
import {
  createSession,
  createStudent,
  deleteSession,
  deleteStudent,
  fetchSessions,
  fetchStudents,
  updateSession,
  updateSessionsBulk,
  updateStudent,
  type SessionInput,
  type SessionUpdate,
  type StudentInput,
  type StudentUpdate,
} from './api/data'
import { Sidebar } from './components/Sidebar'
import { AgendaPage } from './pages/AgendaPage'
import { StudentsPage } from './pages/StudentsPage'
import { WhatsAppPage } from './pages/WhatsAppPage'
import './App.css'

export default function App() {
  const [page, setPage] = useState<AppPage>('agenda')
  const [students, setStudents] = useState<Student[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [nextStudents, nextSessions] = await Promise.all([
        fetchStudents(),
        fetchSessions(),
      ])
      setStudents(nextStudents)
      setSessions(nextSessions)
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Falha ao carregar dados'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const handleCreateStudent = useCallback(async (input: StudentInput) => {
    const created = await createStudent(input)
    setStudents((prev) => [...prev, created])
    return created
  }, [])

  const handleUpdateStudent = useCallback(
    async (id: number, input: StudentUpdate) => {
      const updated = await updateStudent(id, input)
      setStudents((prev) => prev.map((s) => (s.id === id ? updated : s)))
      return updated
    },
    [],
  )

  const handleDeleteStudent = useCallback(async (id: number) => {
    await deleteStudent(id)
    setStudents((prev) => prev.filter((s) => s.id !== id))
    setSessions((prev) => prev.filter((s) => s.studentId !== id))
  }, [])

  const handleCreateSession = useCallback(async (input: SessionInput) => {
    const created = await createSession(input)
    setSessions((prev) => [...prev, created])
    return created
  }, [])

  const handleUpdateSession = useCallback(
    async (id: number, input: SessionUpdate) => {
      const updated = await updateSession(id, input)
      setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)))
      return updated
    },
    [],
  )

  const handleDeleteSession = useCallback(async (id: number) => {
    await deleteSession(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const handleBulkUpdateSessions = useCallback(
    async (
      items: { id: number; day?: DayOfWeek; time?: string }[],
    ) => {
      if (items.length === 0) return
      const updated = await updateSessionsBulk(items)
      const byId = new Map(updated.map((s) => [s.id, s]))
      setSessions((prev) => prev.map((s) => byId.get(s.id) ?? s))
    },
    [],
  )

  return (
    <div className="app-shell">
      <Sidebar
        currentPage={page}
        onNavigate={setPage}
        studentCount={students.length}
      />
      <div className="app-content">
        {loading ? (
          <div className="page page--status">
            <p className="page-status">Carregando agenda...</p>
          </div>
        ) : null}

        {!loading && error ? (
          <div className="page page--status">
            <div className="whatsapp-banner whatsapp-banner--error">{error}</div>
            <button type="button" className="btn btn--primary" onClick={() => void reload()}>
              Tentar de novo
            </button>
          </div>
        ) : null}

        {!loading && !error && page === 'agenda' ? (
          <AgendaPage
            students={students}
            sessions={sessions}
            onCreateSession={handleCreateSession}
            onUpdateSession={handleUpdateSession}
            onDeleteSession={handleDeleteSession}
            onBulkUpdateSessions={handleBulkUpdateSessions}
          />
        ) : null}

        {!loading && !error && page === 'alunos' ? (
          <StudentsPage
            students={students}
            sessions={sessions}
            onCreateStudent={handleCreateStudent}
            onUpdateStudent={handleUpdateStudent}
            onDeleteStudent={handleDeleteStudent}
          />
        ) : null}

        {!loading && !error && page === 'whatsapp' ? (
          <WhatsAppPage students={students} sessions={sessions} />
        ) : null}
      </div>
    </div>
  )
}
