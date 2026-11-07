import { useState } from 'react'
import { ClassSchedulePanel } from '../components/ClassSchedulePanel'
import { ClassStudentsPanel } from '../components/ClassStudentsPanel'
import { ClassWorkoutsPanel } from '../components/ClassWorkoutsPanel'

type Section = 'alunos' | 'horarios' | 'treinos'

const SECTIONS: { id: Section; label: string }[] = [
  { id: 'alunos', label: 'Gestão de alunos' },
  { id: 'horarios', label: 'Gestão de horários' },
  { id: 'treinos', label: 'Gestão de treinos' },
]

export function ClassPage() {
  const [section, setSection] = useState<Section>('alunos')

  return (
    <div className="page class-page">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Crossfit/Hyrox</h1>
          <p className="page-header__subtitle">
            Alunos, horários fixos e treinos da semana.
          </p>
        </div>
      </header>
      <div className="class-page__body">
        <div className="segmented class-sections" role="tablist" aria-label="Gestão">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={section === item.id}
              className={section === item.id ? 'is-active' : undefined}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {section === 'alunos' ? <ClassStudentsPanel /> : null}
        {section === 'horarios' ? <ClassSchedulePanel /> : null}
        {section === 'treinos' ? <ClassWorkoutsPanel /> : null}
      </div>
    </div>
  )
}