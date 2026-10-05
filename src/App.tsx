import { useCallback, useEffect, useState } from 'react'
import type { AppPage, Session, Student } from './types'
import { fetchMe } from './api/auth'
import { clearToken, getToken, setUnauthorizedHandler } from './api/http'
import {
  createSession,
  createStudent,
  deleteSession,
  deleteStudent,
  fetchSessions,
  fetchStudents,
  updateSession,
  updateStudent,
  type SessionInput,
  type SessionUpdate,
  type StudentInput,
  type StudentUpdate,
} from './api/data'
import { Sidebar } from './components/Sidebar'
import { AgendaPage } from './pages/AgendaPage'
import { LoginPage } from './pages/LoginPage'
import { StudentsPage } from './pages/StudentsPage'
import { WhatsAppPage } from './pages/WhatsAppPage'
import './App.css'

type AuthState = 'checking' | 'in' | 'out' | 'error'

export default function App() {
  const [auth, setAuth] = useState<AuthState>(() =>
    getToken() ? 'checking' : 'out',
  )
  const [authError, setAuthError] = useState<string | null>(null)
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

  const enter = useCallback(() => {
    setLoading(true)
    setError(null)
    setAuth('in')
  }, [])

  const checkSession = useCallback(async () => {
    if (!getToken()) {
      setAuth('out')
      return
    }
    setAuth('checking')
    setAuthError(null)
    try {
      await fetchMe()
      enter()
    } catch (err) {
      if (!getToken()) {
        setAuth('out')
        return
      }
      setAuthError(
        err instanceof Error ? err.message : 'Falha ao validar sessão',
      )
      setAuth('error')
    }
  }, [enter])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAuth('out')
      setAuthError(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    void checkSession()
  }, [checkSession])

  useEffect(() => {
    if (auth !== 'in') return
    void reload()
  }, [auth, reload])

  function handleLogout() {
    clearToken()
    setStudents([])
    setSessions([])
    setError(null)
    setPage('agenda')
    setAuth('out')
  }

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
      let previous: Session | undefined
      setSessions((prev) => {
        previous = prev.find((s) => s.id === id)
        if (!previous) return prev
        return prev.map((s) => {
          if (s.id !== id) return s
          return {
            ...s,
            ...(input.day !== undefined ? { day: input.day } : {}),
            ...(input.time !== undefined ? { time: input.time } : {}),
            ...(input.studentId !== undefined
              ? { studentId: input.studentId }
              : {}),
          }
        })
      })

      try {
        const updated = await updateSession(id, input)
        setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)))
        return updated
      } catch (err) {
        if (previous) {
          const snapshot = previous
          setSessions((prev) =>
            prev.map((s) => (s.id === id ? snapshot : s)),
          )
        }
        throw err
      }
    },
    [],
  )

  const handleDeleteSession = useCallback(async (id: number) => {
    await deleteSession(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }, [])

  if (auth === 'checking') {
    return (
      <div className="login-screen">
        <p className="page-status">Carregando...</p>
      </div>
    )
  }

  if (auth === 'error') {
    return (
      <div className="login-screen">
        <div className="whatsapp-banner whatsapp-banner--error">{authError}</div>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => void checkSession()}
        >
          Tentar de novo
        </button>
      </div>
    )
  }

  if (auth === 'out') {
    return <LoginPage onSuccess={enter} />
  }

  return (
    <div className="app-shell">
      <Sidebar
        currentPage={page}
        onNavigate={setPage}
        studentCount={students.length}
        onLogout={handleLogout}
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
