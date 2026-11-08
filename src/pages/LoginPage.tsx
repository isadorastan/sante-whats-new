import { useEffect, useState, type FormEvent } from 'react'
import { login, type AccountRole } from '../api/auth'
import { clearToken } from '../api/http'
import { alunoHref } from '../utils/paths'

interface LoginPageProps {
  onSuccess: () => void
  onBack?: () => void
  expectedRole?: AccountRole
  title?: string
  tagline?: string
  wrongRoleMessage?: string
  alternateHref?: string
  alternateLabel?: string
}

export function LoginPage({
  onSuccess,
  onBack,
  expectedRole = 'professor',
  title = 'Agenda Personal',
  tagline = 'Entre para continuar',
  wrongRoleMessage = 'Esta entrada é do professor.',
  alternateHref,
  alternateLabel,
}: LoginPageProps) {
  const identifierLabel = expectedRole === 'student' ? 'Usuário' : 'E-mail'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (expectedRole !== 'student') return
    const params = new URLSearchParams(window.location.search)
    const email = params.get('email') ?? params.get('usuario') ?? ''
    const senha = params.get('senha') ?? ''
    if (email) setUsername(email)
    if (senha) setPassword(senha)
    if (!email && !senha) return
    const url = new URL(window.location.href)
    url.searchParams.delete('email')
    url.searchParams.delete('usuario')
    url.searchParams.delete('senha')
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
  }, [expectedRole])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const role = await login(username.trim(), password)
      if (role !== expectedRole) {
        clearToken()
        setError(wrongRoleMessage)
        return
      }
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao entrar')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={(event) => void handleSubmit(event)}>
        {onBack ? (
          <button type="button" className="login-back" onClick={onBack}>
            Voltar
          </button>
        ) : null}
        <div className="login-card__brand">
          <span className="sidebar__mark" aria-hidden />
          <div>
            <p className="sidebar__title">{title}</p>
            <p className="sidebar__tagline">{tagline}</p>
          </div>
        </div>

        {error ? (
          <div className="whatsapp-banner whatsapp-banner--error">{error}</div>
        ) : null}

        <label className="students-field">
          <span>{identifierLabel}</span>
          <input
            className="students-form__input"
            name="email"
            type={expectedRole === 'student' ? 'text' : 'email'}
            autoComplete="username"
            autoCapitalize="none"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>

        <label className="students-field">
          <span>Senha</span>
          <div className="password-field">
            <input
              className="students-form__input"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="password-field__toggle"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((current) => !current)}
            >
              <EyeIcon off={showPassword} />
            </button>
          </div>
        </label>

        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? 'Entrando...' : 'Entrar'}
        </button>
        {(alternateHref ?? (expectedRole === 'professor' ? alunoHref() : undefined)) &&
        (alternateLabel ?? (expectedRole === 'professor' ? 'Sou aluno' : undefined)) ? (
          <a
            className="login-alt"
            href={alternateHref ?? alunoHref()}
          >
            {alternateLabel ?? 'Sou aluno'}
          </a>
        ) : null}
      </form>
    </div>
  )
}

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      {off ? (
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          d="M3 3l18 18M10.6 10.7a3 3 0 0 0 4.2 4.2M9.9 5.2A10.4 10.4 0 0 1 12 5c5.2 0 9.2 4.2 10.2 6.5a12 12 0 0 1-2.2 3.2M6.2 6.3C4.4 7.6 3 9.4 1.8 12c1 2.4 4.8 6.5 10.2 6.5 1.4 0 2.8-.3 4-.8"
        />
      ) : (
        <>
          <path
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"
          />
          <circle cx="12" cy="12" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        </>
      )}
    </svg>
  )
}
