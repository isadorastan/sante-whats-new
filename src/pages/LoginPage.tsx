import { useState, type FormEvent } from 'react'
import { login } from '../api/auth'

interface LoginPageProps {
  onSuccess: () => void
}

export function LoginPage({ onSuccess }: LoginPageProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await login(username.trim(), password)
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
        <div className="login-card__brand">
          <span className="sidebar__mark" aria-hidden />
          <div>
            <p className="sidebar__title">Agenda Personal</p>
            <p className="sidebar__tagline">Entre para continuar</p>
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
      </form>
    </div>
  )
}
