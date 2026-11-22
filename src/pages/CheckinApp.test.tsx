import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { setToken } from '../api/http'
import { brazilMonth, rankingMonthLabel } from '../utils/dates'
import { CheckinApp } from './CheckinApp'

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

const week = {
  weekStart: '2026-11-16',
  today: '2026-11-22',
  nowTime: '09:00',
  modalities: {
    crossfit: { days: [] },
    hyrox: { days: [] },
  },
}

function account(flags: { crossfit: boolean; hyrox: boolean }) {
  return {
    ok: true,
    username: 'lia',
    role: 'student',
    name: 'Lia',
    ...flags,
  }
}

beforeEach(() => {
  localStorage.clear()
  setToken('test-token')
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

it('mostra o ranking geral e o do mês na comunidade', async () => {
  const user = userEvent.setup()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/auth/me')) return json(account({ crossfit: true, hyrox: true }))
      if (url.includes('/api/class/week')) return json(week)
      if (url.includes('/api/class/ranking') && url.includes('scope=month')) {
        return json({
          modality: 'hyrox',
          scope: 'month',
          month: '2026-11',
          rows: [{ rank: 1, name: 'Lia', count: 3, mine: true }],
        })
      }
      if (url.includes('/api/class/ranking')) {
        return json({
          modality: 'hyrox',
          scope: 'all',
          month: null,
          rows: [
            { rank: 1, name: 'Ana', count: 8, mine: false },
            { rank: 2, name: 'Lia', count: 4, mine: true },
          ],
        })
      }
      return new Response('not found', { status: 404 })
    }),
  )

  render(<CheckinApp />)

  expect(await screen.findByText('Nenhum dia ligado nesta modalidade.')).toBeInTheDocument()
  await user.click(screen.getByRole('tab', { name: 'Comunidade' }))

  expect(screen.getByRole('tab', { name: 'Hyrox' })).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Crossfit' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Ranking 🏆' })).toBeInTheDocument()
  const monthTab = screen.getByRole('tab', { name: rankingMonthLabel(brazilMonth()) })
  expect(monthTab).toHaveAttribute('aria-selected', 'true')
  const list = await screen.findByRole('list')
  let items = within(list).getAllByRole('listitem')
  expect(items).toHaveLength(1)
  expect(items[0]).toHaveTextContent('Lia')
  expect(items[0]).toHaveTextContent('3')

  await user.click(screen.getByRole('tab', { name: 'Geral' }))
  items = await within(list).findAllByRole('listitem')
  expect(items[0]).toHaveTextContent('Ana')
  expect(items[0]).toHaveTextContent('8')
  expect(items[1]).toHaveTextContent('Lia')
  expect(items[1]).toHaveTextContent('você')
})

it('esconde o seletor quando o aluno faz só uma modalidade', async () => {
  const user = userEvent.setup()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/auth/me')) return json(account({ crossfit: true, hyrox: false }))
      if (url.includes('/api/class/week')) {
        return json({ ...week, modalities: { crossfit: { days: [] } } })
      }
      return json({ modality: 'crossfit', scope: 'all', month: null, rows: [] })
    }),
  )

  render(<CheckinApp />)

  await screen.findByRole('tab', { name: 'Comunidade' })
  await user.click(screen.getByRole('tab', { name: 'Comunidade' }))

  expect(await screen.findByText('Ninguém fez check-in nesse período.')).toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Hyrox' })).not.toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Crossfit' })).not.toBeInTheDocument()
  expect(screen.getByRole('tab', { name: 'Geral' })).toBeInTheDocument()
})
