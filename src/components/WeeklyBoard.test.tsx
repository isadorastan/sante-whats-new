import { render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import type { Session, Student } from '../types'
import { WeeklyBoard } from './WeeklyBoard'

const ana: Student = {
  id: 1,
  name: 'Ana Costa',
  phone: '51999999999',
  weeklyClasses: 2,
  planValue: 200,
  color: '#2dd4a8',
  status: 'ativo',
  startedOn: '2026-01-01',
  endedOn: null,
  billingDay: 10,
  customPrice: false,
}

function session(id: number, time: string): Session {
  return { id, studentId: ana.id, day: 'seg', time, durationMinutes: 45 }
}

it('mostra horários de 15 em 15 e mantém a aula no horário já salvo', () => {
  render(
    <WeeklyBoard
      students={[ana]}
      sessions={[session(1, '08:00'), session(2, '08:30')]}
      visibleDays={['seg']}
      onCreateSession={vi.fn()}
      onUpdateSession={vi.fn()}
      onDeleteSession={vi.fn()}
    />,
  )

  for (const time of ['08:00', '08:15', '08:30', '08:45']) {
    expect(screen.getByText(time)).toBeInTheDocument()
  }

  expect(document.querySelector('[data-time="08:00"]')).toHaveTextContent('Ana Costa')
  expect(document.querySelector('[data-time="08:15"]')).not.toHaveTextContent('Ana Costa')
  expect(document.querySelector('[data-time="08:30"]')).toHaveTextContent('Ana Costa')
})
