import type { AppPage } from '../types'

interface SidebarProps {
  currentPage: AppPage
  onNavigate: (page: AppPage) => void
  studentCount: number
  onLogout: () => void
}

const NAV_ITEMS: { id: AppPage; label: string; hint: string }[] = [
  { id: 'agenda', label: 'Agenda', hint: 'Grade semanal' },
  { id: 'alunos', label: 'Alunos', hint: 'Cadastro' },
  { id: 'whatsapp', label: 'WhatsApp', hint: 'Avisos do dia' },
]

export function Sidebar({
  currentPage,
  onNavigate,
  studentCount,
  onLogout,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__mark" aria-hidden />
        <div>
          <p className="sidebar__title">Agenda Personal</p>
          <p className="sidebar__tagline">Studio</p>
        </div>
      </div>

      <nav className="sidebar__nav" aria-label="Principal">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`sidebar__link${currentPage === item.id ? ' is-active' : ''}`}
            aria-current={currentPage === item.id ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            <span className="sidebar__link-label">{item.label}</span>
            <span className="sidebar__link-hint">
              {item.id === 'alunos' ? `${studentCount} cadastrados` : item.hint}
            </span>
          </button>
        ))}
      </nav>

      <div className="sidebar__footer">
        <button type="button" className="btn sidebar__logout" onClick={onLogout}>
          Sair
        </button>
      </div>
    </aside>
  )
}
