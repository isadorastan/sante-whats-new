import { useEffect, useState } from 'react'

const DISMISS_KEY = 'sante-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
}

function isStandalone(): boolean {
  const nav = navigator as Navigator & { standalone?: boolean }
  return (
    window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true
  )
}

function isIos(): boolean {
  const nav = navigator as Navigator & { maxTouchPoints?: number }
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (nav.maxTouchPoints ?? 0) > 1)
  )
}

export function InstallHint() {
  const [hidden, setHidden] = useState(() => {
    if (typeof window === 'undefined') return true
    return isStandalone() || localStorage.getItem(DISMISS_KEY) === '1'
  })
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (hidden) return
    function onPrompt(event: Event) {
      event.preventDefault()
      setPromptEvent(event as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [hidden])

  if (hidden) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setHidden(true)
  }

  async function install() {
    if (!promptEvent) return
    await promptEvent.prompt()
    setPromptEvent(null)
  }

  return (
    <aside className="class-install">
      <div>
        <p className="class-install__title">Atalho na tela inicial</p>
        {isIos() ? (
          <p>
            No iPhone, toque em Compartilhar e depois em Adicionar à Tela de Início.
            Entre de novo pelo ícone: o login feito no Safari não vai junto.
          </p>
        ) : (
          <p>
            Adicione este check-in à tela inicial para abrir como um app. A agenda
            continua vindo da rede.
          </p>
        )}
      </div>
      <div className="class-install__actions">
        {promptEvent ? (
          <button type="button" className="btn btn--primary" onClick={() => void install()}>
            Adicionar à tela inicial
          </button>
        ) : null}
        <button type="button" className="btn" onClick={dismiss}>
          Agora não
        </button>
      </div>
    </aside>
  )
}