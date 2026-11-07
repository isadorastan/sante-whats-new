import { useState, type FormEvent } from 'react'
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
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
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
          <span>E-mail</span>
          <input
            className="students-form__input"
            name="email"
            type="email"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>

        <label className="students-field">
          <span>Senha</span>
          <input
            className="students-form__input"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
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
