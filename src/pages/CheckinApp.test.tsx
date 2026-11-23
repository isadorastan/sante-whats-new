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

const emptyInvites = { classmates: [], sent: [], received: [] }

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
      if (url.includes('/api/class/invites')) return json(emptyInvites)
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

  const ranking = screen.getByRole('region', { name: 'Comunidade' })
  expect(within(ranking).getByRole('tab', { name: 'Hyrox' })).toBeInTheDocument()
  expect(within(ranking).getByRole('tab', { name: 'Crossfit' })).toBeInTheDocument()
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
      if (url.includes('/api/class/invites')) return json(emptyInvites)
      if (url.includes('/api/class/week')) {
        return json({ ...week, modalities: { crossfit: { days: [] } } })
      }
      if (url.includes('/api/class/stats')) {
        return json({
          total: 5,
          month: 1,
          week: 0,
          firstOn: '2026-10-01',
          crossfit: 5,
          hyrox: 0,
          from: '2025-11-17',
          today: '2026-11-22',
          days: [],
        })
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

  await user.click(screen.getByRole('tab', { name: 'Estatísticas' }))
  const stats = await screen.findByRole('region', { name: 'Estatísticas' })
  expect(within(stats).getByText('Total').closest('div')).toHaveTextContent('5')
  expect(within(stats).getByRole('heading', { name: 'Seus check-ins 💪' })).toBeInTheDocument()
  expect(within(stats).getByRole('heading', { name: 'Novembro 2026' })).toBeInTheDocument()
  expect(within(stats).queryByText('Crossfit')).not.toBeInTheDocument()
  expect(within(stats).queryByText('Hyrox')).not.toBeInTheDocument()
})

it('mostra o gráfico, as contagens e o recorte das duas modalidades', async () => {
  const user = userEvent.setup()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/auth/me')) return json(account({ crossfit: true, hyrox: true }))
      if (url.includes('/api/class/invites')) return json(emptyInvites)
      if (url.includes('/api/class/week')) return json(week)
      if (url.includes('/api/class/stats')) {
        return json({
          total: 18,
          month: 4,
          week: 2,
          firstOn: '2024-03-03',
          crossfit: 11,
          hyrox: 7,
          from: '2025-11-17',
          today: '2026-11-22',
          days: [{ date: '2026-11-18', count: 2 }],
        })
      }
      return new Response('not found', { status: 404 })
    }),
  )

  render(<CheckinApp />)

  await user.click(await screen.findByRole('tab', { name: 'Estatísticas' }))
  const stats = await screen.findByRole('region', { name: 'Estatísticas' })
  expect(within(stats).getByText('Total').closest('div')).toHaveTextContent('18')
  expect(within(stats).getByText('Neste mês').closest('div')).toHaveTextContent('4')
  expect(within(stats).getByText('Nesta semana').closest('div')).toHaveTextContent('2')
  expect(within(stats).getByText('Crossfit').closest('div')).toHaveTextContent('11')
  expect(within(stats).getByText('Hyrox').closest('div')).toHaveTextContent('7')
  expect(within(stats).getByRole('heading', { name: 'Seus check-ins 💪' })).toBeInTheDocument()
  expect(within(stats).getByRole('heading', { name: 'Novembro 2026' })).toBeInTheDocument()
  expect(within(stats).getByRole('heading', { name: '2026' })).toBeInTheDocument()
  expect(within(stats).getAllByTitle('18/11/2026 · 2 check-ins')).toHaveLength(2)
  expect(within(stats).getByText('Menos')).toBeInTheDocument()
  expect(within(stats).getByText('Mais')).toBeInTheDocument()
})

it('mostra o convite ao entrar e abre a comunidade para responder', async () => {
  const user = userEvent.setup()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/api/auth/me')) return json(account({ crossfit: true, hyrox: true }))
      if (url.includes('/api/class/week')) {
        return json({
          ...week,
          modalities: {
            hyrox: { days: [] },
            crossfit: {
              days: [
                {
                  date: '2026-11-24',
                  day: 'ter',
                  workout: '',
                  slots: [
                    {
                      id: 9,
                      time: '18:00',
                      capacity: 12,
                      canJoin: true,
                      canLeave: false,
                      myCheckinId: null,
                      checkins: [],
                    },
                  ],
                },
              ],
            },
          },
        })
      }
      if (url.includes('/api/class/ranking')) {
        return json({ modality: 'hyrox', scope: 'month', month: '2026-11', rows: [] })
      }
      if (url.includes('/api/class/invites')) {
        return json({
          classmates: [{ id: 2, name: 'Ana', crossfit: true, hyrox: true }],
          sent: [
            {
              id: 8,
              fromStudentId: 1,
              fromName: 'Lia',
              toStudentId: 3,
              toName: 'Caio',
              slotId: 9,
              classOn: '2026-11-24',
              modality: 'crossfit',
              day: 'ter',
              time: '18:00',
              status: 'accepted',
            },
          ],
          received: [
            {
              id: 4,
              fromStudentId: 2,
              fromName: 'Ana',
              toStudentId: 1,
              toName: 'Lia',
              slotId: 9,
              classOn: '2026-11-24',
              modality: 'crossfit',
              day: 'ter',
              time: '18:00',
              status: 'pending',
            },
            {
              id: 5,
              fromStudentId: 6,
              fromName: 'Bia',
              toStudentId: 1,
              toName: 'Lia',
              slotId: 9,
              classOn: '2026-11-24',
              modality: 'crossfit',
              day: 'ter',
              time: '18:00',
              status: 'declined',
            },
            {
              id: 7,
              fromStudentId: 8,
              fromName: 'Leo',
              toStudentId: 1,
              toName: 'Lia',
              slotId: 9,
              classOn: '2026-11-24',
              modality: 'crossfit',
              day: 'ter',
              time: '18:00',
              status: 'accepted',
            },
          ],
        })
      }
      return new Response('not found', { status: 404 })
    }),
  )

  render(<CheckinApp />)

  await user.click(await screen.findByRole('button', { name: 'Ana te convidou para treinar' }))
  expect(screen.getByRole('tab', { name: 'Check-in' })).toHaveAttribute('aria-selected', 'true')
  const invites = await screen.findByText('Convites')
  expect(invites).toBeInTheDocument()
  expect(screen.getByText('Chame um amigo pra treinar com você')).toBeInTheDocument()
  const slot = screen.getByText('Convites').closest('.class-slot') as HTMLElement
  expect(within(slot).getByRole('button', { name: 'Convidar amigo' })).toBeInTheDocument()
  const ana = within(slot).getByText('Ana convidou você').closest('li')
  expect(ana).not.toBeNull()
  expect(within(ana as HTMLElement).getByRole('button', { name: 'Aceitar' })).toBeInTheDocument()
  expect(within(ana as HTMLElement).getByRole('button', { name: 'Recusar' })).toBeInTheDocument()
  await user.click(within(ana as HTMLElement).getByRole('button', { name: 'Aceitar' }))
  const confirm = screen.getByRole('dialog', { name: 'Confirmar check-in' })
  expect(within(confirm).getByText('Seu check-in será feito automaticamente nessa aula.')).toBeInTheDocument()
  await user.click(within(confirm).getByRole('button', { name: 'Cancelar' }))
  expect(screen.queryByRole('dialog', { name: 'Confirmar check-in' })).not.toBeInTheDocument()
  const caio = within(slot).getByText('Você convidou Caio').closest('li')
  expect(caio).not.toBeNull()
  expect(within(caio as HTMLElement).getByText('Aceito')).toBeInTheDocument()
  expect(within(caio as HTMLElement).queryByRole('button', { name: 'Recusar' })).not.toBeInTheDocument()
  const leo = within(slot).getByText('Leo convidou você').closest('li')
  expect(leo).not.toBeNull()
  expect(within(leo as HTMLElement).getByText('Aceito')).toBeInTheDocument()
  expect(within(leo as HTMLElement).getByRole('button', { name: 'Recusar' })).toBeInTheDocument()
  const bia = within(slot).getByText('Bia convidou você').closest('li')
  expect(bia).not.toBeNull()
  expect(within(bia as HTMLElement).getByText('Recusou')).toBeInTheDocument()
  expect(within(bia as HTMLElement).getByRole('button', { name: 'Aceitar' })).toBeInTheDocument()
  expect(within(slot).getAllByRole('listitem')).toHaveLength(4)
  await user.click(within(slot).getByRole('button', { name: 'Convidar amigo' }))
  expect(screen.getByRole('dialog', { name: 'Convidar amigo' })).toBeInTheDocument()
})
