import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { ClassPage } from './ClassPage'

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/class/students')) {
        return json([
          { id: 1, name: 'Ana', email: 'ana@x.com', crossfit: true, hyrox: false },
        ])
      }
      if (url.includes('/api/class/attendance')) {
        return json({ month: '2026-11', scope: 'studio', rows: [] })
      }
      if (url.includes('/api/class/schedule')) {
        return json({
          modality: 'hyrox',
          days: ['seg'],
          slots: [{ id: 4, modality: 'hyrox', day: 'seg', time: '07:00', capacity: 12 }],
        })
      }
      if (url.includes('/api/class/workouts')) {
        return json({
          modality: 'hyrox',
          weekStart: '2026-11-02',
          days: [
            { day: 'seg', date: '2026-11-02', body: '' },
            { day: 'ter', date: '2026-11-03', body: 'Fran' },
          ],
        })
      }
      return json({})
    }),
  )
})

it('mostra modalidade do aluno, adição e edição de horário e treino', async () => {
  const user = userEvent.setup()
  render(<ClassPage />)

  expect(screen.getByRole('button', { name: 'Adicionar' })).toBeInTheDocument()
  expect(screen.getAllByRole('checkbox', { name: 'Crossfit' }).length).toBeGreaterThan(0)
  expect(screen.getAllByRole('checkbox', { name: 'Hyrox' }).length).toBeGreaterThan(0)
  await waitFor(() => {
    expect(screen.getByText('ana@x.com')).toBeInTheDocument()
  })

  await user.click(screen.getByRole('tab', { name: 'Gestão de horários' }))
  expect(screen.getByRole('button', { name: 'Adicionar horário' })).toBeInTheDocument()
  await waitFor(() => {
    expect(screen.getByDisplayValue('07:00')).toBeInTheDocument()
  })
  expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Apagar' })).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: 'Gestão de treinos' }))
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Adicionar treino' })).toBeInTheDocument()
  })
  expect(screen.getByRole('button', { name: 'Salvar treino' })).toBeInTheDocument()
})
