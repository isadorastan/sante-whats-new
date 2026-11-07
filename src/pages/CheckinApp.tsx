import { useCallback, useEffect, useState } from 'react'
import { fetchMe, type Account } from '../api/auth'
import { cancelCheckin, createCheckin, fetchClassWeek } from '../api/class'
import { clearToken, getToken, setUnauthorizedHandler } from '../api/http'
import { ClassWeek } from '../components/ClassWeek'
import { InstallHint } from '../components/InstallHint'
import { LoginPage } from './LoginPage'
import type { ClassModality, ClassWeek as ClassWeekData } from '../types'
import { brazilToday } from '../utils/dates'
import { addIsoDays, weekStartMonday } from '../utils/classDates'
import { adminHref } from '../utils/paths'

type Gate = 'checking' | 'out' | 'student' | 'professor' | 'error'

export function CheckinApp() {
  const [gate, setGate] = useState<Gate>(() => (getToken() ? 'checking' : 'out'))
  const [account, setAccount] = useState<Account | null>(null)
  const [gateError, setGateError] = useState<string | null>(null)
  const [modality, setModality] = useState<ClassModality>('hyrox')
  const [weekStart, setWeekStart] = useState(() => weekStartMonday(brazilToday()))
  const [week, setWeek] = useState<ClassWeekData | null>(null)
  const [weekError, setWeekError] = useState<string | null>(null)
  const [loadingWeek, setLoadingWeek] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const loadAccount = useCallback(async () => {
    if (!getToken()) {
      setGate('out')
      setAccount(null)
      return
    }
    setGate('checking')
    setGateError(null)
    try {
      const me = await fetchMe()
      if (me.role !== 'student') {
        setAccount(null)
        setGate('professor')
        return
      }
      if (!me.name) {
        clearToken()
        setAccount(null)
        setGateError('Sua conta não está mais na turma.')
        setGate('out')
        return
      }
      setAccount(me)
      setGate('student')
    } catch (err) {
      if (!getToken()) {
        setGate('out')
        return
      }
      setGateError(err instanceof Error ? err.message : 'Falha ao validar sessão')
      setGate('error')
    }
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setAccount(null)
      setGate('out')
      setGateError(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  useEffect(() => {
    void loadAccount()
  }, [loadAccount])

  useEffect(() => {
    if (gate !== 'student' || !account) return
    if (account.crossfit && !account.hyrox) setModality('crossfit')
    else if (account.hyrox && !account.crossfit) setModality('hyrox')
  }, [gate, account])

  useEffect(() => {
    if (gate !== 'student') return
    let cancelled = false
    setLoadingWeek(true)
    void fetchClassWeek(weekStart)
      .then((next) => {
        if (!cancelled) {
          setWeek(next)
          setWeekError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setWeekError(err instanceof Error ? err.message : 'Falha ao carregar a semana')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingWeek(false)
      })
    return () => {
      cancelled = true
    }
  }, [gate, weekStart])

  async function refreshWeek() {
    const next = await fetchClassWeek(weekStart)
    setWeek(next)
  }

  async function handleCheckIn(slotId: number, date: string) {
    setBusyId(`${date}-${slotId}`)
    setWeekError(null)
    try {
      await createCheckin(slotId, date)
      await refreshWeek()
    } catch (err) {
      setWeekError(err instanceof Error ? err.message : 'Falha ao fazer check-in')
    } finally {
      setBusyId(null)
    }
  }

  async function handleCancel(checkinId: number) {
    setBusyId(`leave-${checkinId}`)
    setWeekError(null)
    try {
      await cancelCheckin(checkinId)
      await refreshWeek()
    } catch (err) {
      setWeekError(err instanceof Error ? err.message : 'Falha ao sair da aula')
    } finally {
      setBusyId(null)
    }
  }

  function logout() {
    clearToken()
    setAccount(null)
    setWeek(null)
    setGate('out')
  }

  if (gate === 'checking') {
    return (
      <div className="login-screen">
        <p className="page-status">Carregando...</p>
      </div>
    )
  }

  if (gate === 'error') {
    return (
      <div className="login-screen">
        <div className="whatsapp-banner whatsapp-banner--error">{gateError}</div>
        <button type="button" className="btn btn--primary" onClick={() => void loadAccount()}>
          Tentar de novo
        </button>
      </div>
    )
  }

  if (gate === 'professor') {
    return (
      <div className="login-screen">
        <div className="login-card">
          <p>Esta entrada é dos alunos.</p>
          <a className="btn btn--primary" href={adminHref()}>
            Ir para a agenda
          </a>
        </div>
      </div>
    )
  }

  if (gate === 'out') {
    return (
      <div className="checkin-login">
        <InstallHint />
        {gateError ? (
          <div className="whatsapp-banner whatsapp-banner--error">{gateError}</div>
        ) : null}
        <LoginPage
          title="Centro de Treinamento Santé"
          tagline="Check-in da semana"
          expectedRole="student"
          wrongRoleMessage="Esta entrada é dos alunos."
          alternateHref={adminHref()}
          alternateLabel="É professor? Ir para a agenda"
          onSuccess={() => void loadAccount()}
        />
      </div>
    )
  }

  return (
    <div className="checkin-shell">
      <header className="page-header checkin-header">
        <div>
          <p className="page-header__title">Check-in</p>
          <p className="page-header__subtitle">{account?.name}</p>
        </div>
        <button type="button" className="btn" onClick={logout}>
          Sair
        </button>
      </header>
      <InstallHint />
      <div className="class-page__body">
          {weekError ? (
            <div className="whatsapp-banner whatsapp-banner--error">{weekError}</div>
          ) : null}
          {account && !account.crossfit && !account.hyrox ? (
            <p className="class-empty">Sua conta não está no Crossfit nem no Hyrox.</p>
          ) : null}
          {loadingWeek && !week ? <p className="page-status">Carregando agenda...</p> : null}
          {week && (account?.crossfit || account?.hyrox) ? (
            <div className="class-week-wrap">
              {loadingWeek ? (
                <div className="class-week-loading" role="status">
                  <span className="class-week-loading__spin" aria-hidden="true" />
                  Carregando...
                </div>
              ) : null}
              <ClassWeek
                week={week}
                modality={modality}
                onModality={setModality}
              onShiftWeek={(delta) =>
                setWeekStart((current) => {
                  const thisWeek = weekStartMonday(brazilToday())
                  const following = addIsoDays(thisWeek, 7)
                  const next = addIsoDays(current, delta * 7)
                  if (next < thisWeek) return thisWeek
                  if (next > following) return following
                  return next
                })
              }
                onCheckIn={handleCheckIn}
                onCancel={handleCancel}
                busyId={busyId}
              />
            </div>
          ) : null}
      </div>
    </div>
  )
}