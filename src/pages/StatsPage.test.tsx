import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  fetchAllPayments,
  fetchPayments,
  fetchPlanPrices,
  markPaymentPaid,
  markPaymentUnpaid,
} from '../api/data'
import type { Session, Student } from '../types'
import { StatsPage } from './StatsPage'

vi.mock('../utils/dates', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/dates')>()
  return {
    ...actual,
    brazilToday: () => '2026-10-08',
    brazilMonth: () => '2026-10',
  }
})

vi.mock('../api/data', () => ({
  fetchPlanPrices: vi.fn(),
  fetchPayments: vi.fn(),
  fetchAllPayments: vi.fn(),
  markPaymentPaid: vi.fn(),
  markPaymentUnpaid: vi.fn(),
}))

function student(overrides: Partial<Student> & Pick<Student, 'id' | 'name'>): Student {
  return {
    phone: '11999999999',
    weeklyClasses: 2,
    planValue: 200,
    color: '#2dd4a8',
    status: 'ativo',
    startedOn: '2025-01-10',
    endedOn: null,
    billingDay: 5,
    customPrice: false,
    ...overrides,
  }
}

const ana = student({ id: 1, name: 'Ana', planValue: 200 })
const bruno = student({
  id: 2,
  name: 'Bruno',
  planValue: 100,
  startedOn: '2026-10-01',
  billingDay: 20,
})

const sessions: Session[] = [
  { id: 1, studentId: 1, day: 'seg', time: '07:00', durationMinutes: 45 },
]

beforeEach(() => {
  vi.mocked(fetchPlanPrices).mockResolvedValue([{ weeklyClasses: 2, amount: 180 }])
  vi.mocked(fetchPayments).mockResolvedValue([
    {
      id: 1,
      studentId: 1,
      competence: '2026-10',
      amount: 200,
      dueOn: '2026-10-05',
      paidOn: null,
    },
    {
      id: 2,
      studentId: 2,
      competence: '2026-10',
      amount: 100,
      dueOn: '2026-10-20',
      paidOn: null,
    },
  ])
  vi.mocked(fetchAllPayments).mockResolvedValue([
    {
      id: 9,
      studentId: 1,
      competence: '2026-09',
      amount: 150,
      dueOn: '2026-09-05',
      paidOn: '2026-09-05',
    },
  ])
  vi.mocked(markPaymentPaid).mockResolvedValue({
    id: 1,
    studentId: 1,
    competence: '2026-10',
    amount: 200,
    dueOn: '2026-10-05',
    paidOn: '2026-10-08',
  })
  vi.mocked(markPaymentUnpaid).mockResolvedValue({
    id: 1,
    studentId: 1,
    competence: '2026-10',
    amount: 200,
    dueOn: '2026-10-05',
    paidOn: null,
  })
})

it('mostra faturamento, defasados e baixa o pagamento em atraso', async () => {
  const user = userEvent.setup()
  render(<StatsPage students={[ana, bruno]} sessions={sessions} />)

  expect(await screen.findAllByText('outubro de 2026')).not.toHaveLength(0)
  expect(await screen.findAllByRole('columnheader', { name: 'Aluno' })).not.toHaveLength(0)
  expect(screen.getByRole('region', { name: 'Dinheiro' })).toHaveTextContent('300,00')
  expect(screen.getByRole('region', { name: 'Para resolver' })).toHaveTextContent('Bruno')
  const revenueChart = screen.getByRole('img', { name: 'Faturamento por mês' })
  const studentsChart = screen.getByRole('img', { name: 'Alunos por mês' })
  expect(within(revenueChart).getByText('jan/26')).toBeInTheDocument()
  expect(within(revenueChart).getByText('out/26')).toBeInTheDocument()
  expect(within(revenueChart).queryByText('dez/25')).not.toBeInTheDocument()
  expect(within(studentsChart).queryByText('jan/25')).not.toBeInTheDocument()

  await user.hover(within(revenueChart).getByText('out/26'))
  expect(revenueChart.parentElement).toHaveTextContent(/outubro de 2026/)
  expect(revenueChart.parentElement).toHaveTextContent(/300,00/)
  await user.hover(within(revenueChart).getByText('jan/26'))
  expect(revenueChart.parentElement).toHaveTextContent('Sem registro')
  await user.hover(within(studentsChart).getByText('out/26'))
  expect(studentsChart.parentElement).toHaveTextContent(/2 alunos/)

  const payments = screen.getByRole('heading', { name: 'Pagamentos do mês' }).closest('section')
  expect(payments).not.toBeNull()
  const lateRow = within(payments as HTMLElement).getByText('Em atraso').closest('tr')
  expect(lateRow).not.toBeNull()
  expect(within(lateRow as HTMLElement).getByText('Em atraso')).toBeInTheDocument()
  const openRow = screen.getByRole('cell', { name: 'Bruno' }).closest('tr')
  expect(openRow).not.toBeNull()
  expect(within(openRow as HTMLElement).queryByText('Em aberto')).not.toBeInTheDocument()
  expect(within(openRow as HTMLElement).getByRole('button', { name: 'Marcar pago' })).toBeInTheDocument()
  expect(within(lateRow as HTMLElement).getByText('05/10/2026')).toBeInTheDocument()
  await user.click(within(lateRow as HTMLElement).getByRole('button', { name: 'Marcar pago' }))

  await waitFor(() => {
    expect(markPaymentPaid).toHaveBeenCalledWith(1, '2026-10')
  })
  expect(within(lateRow as HTMLElement).getByText('Pago')).toBeInTheDocument()
  expect(screen.getByText('Nenhum atraso')).toBeInTheDocument()

  await user.click(within(lateRow as HTMLElement).getByRole('button', { name: 'Desfazer' }))
  await waitFor(() => {
    expect(markPaymentUnpaid).toHaveBeenCalledWith(1, '2026-10')
  })
  expect(within(lateRow as HTMLElement).getByText('Em atraso')).toBeInTheDocument()
  expect(within(lateRow as HTMLElement).queryByRole('button', { name: 'Desfazer' })).not.toBeInTheDocument()
  expect(within(lateRow as HTMLElement).getByRole('button', { name: 'Marcar pago' })).toBeInTheDocument()
})

it('mostra a renda registrada ao voltar um mês e esconde a agenda', async () => {
  const user = userEvent.setup()
  render(<StatsPage students={[ana, bruno]} sessions={sessions} />)

  expect(await screen.findByRole('region', { name: 'Agenda' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Mês anterior' }))

  expect(screen.getByText('setembro de 2026')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Dinheiro' })).toHaveTextContent('150,00')
  expect(screen.queryByRole('region', { name: 'Agenda' })).not.toBeInTheDocument()
  expect(screen.queryByText('Mensalidades defasadas')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Mês seguinte' })).toBeEnabled()
})

it('lista cada mensalidade atrasada e dá baixa só naquele mês', async () => {
  const user = userEvent.setup()
  vi.mocked(fetchAllPayments).mockResolvedValue([
    {
      id: 8,
      studentId: 1,
      competence: '2026-08',
      amount: 180,
      dueOn: '2026-08-05',
      paidOn: null,
    },
    {
      id: 9,
      studentId: 1,
      competence: '2026-09',
      amount: 150,
      dueOn: '2026-09-05',
      paidOn: null,
    },
  ])
  vi.mocked(markPaymentPaid).mockResolvedValue({
    id: 8,
    studentId: 1,
    competence: '2026-08',
    amount: 180,
    dueOn: '2026-08-05',
    paidOn: '2026-10-08',
  })

  render(<StatsPage students={[ana, bruno]} sessions={sessions} />)

  const arrears = (await screen.findByRole('heading', { name: 'Atrasos acumulados' })).closest(
    'article',
  )
  expect(arrears).not.toBeNull()
  const panel = arrears as HTMLElement
  const august = within(panel).getByText('agosto de 2026').closest('tr')
  const september = within(panel).getByText('setembro de 2026').closest('tr')
  expect(august).not.toBeNull()
  expect(september).not.toBeNull()
  expect(within(august as HTMLElement).getByText('Ana')).toBeInTheDocument()
  expect(within(august as HTMLElement).getByText(/180,00/)).toBeInTheDocument()
  expect(within(panel).queryByText('Bruno')).not.toBeInTheDocument()

  await user.click(within(august as HTMLElement).getByRole('button', { name: 'Marcar pago' }))

  await waitFor(() => {
    expect(markPaymentPaid).toHaveBeenCalledWith(1, '2026-08')
  })
  expect(within(panel).queryByText('agosto de 2026')).not.toBeInTheDocument()
  expect(within(panel).getByText('setembro de 2026')).toBeInTheDocument()
})
