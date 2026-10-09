import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { fetchProfessor } from '../api/professor'
import {
  fetchWhatsAppStatus,
  sendWhatsAppOne,
  toWhatsAppPhone,
} from '../api/whatsapp'
import type { Session, Student } from '../types'
import { WhatsAppPage } from './WhatsAppPage'

vi.mock('../api/professor', () => ({
  fetchProfessor: vi.fn(),
}))

vi.mock('../api/whatsapp', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/whatsapp')>()
  return {
    ...actual,
    fetchWhatsAppStatus: vi.fn(),
    sendWhatsAppOne: vi.fn(),
    logoutWhatsApp: vi.fn(),
    startWhatsApp: vi.fn(),
    sleep: vi.fn(() => Promise.resolve()),
  }
})

function student(overrides: Partial<Student> & Pick<Student, 'id' | 'name' | 'phone'>): Student {
  return {
    weeklyClasses: 2,
    planValue: 200,
    color: '#2dd4a8',
    status: 'ativo',
    startedOn: null,
    endedOn: null,
    billingDay: null,
    customPrice: false,
    ...overrides,
  }
}

function session(
  overrides: Partial<Session> & Pick<Session, 'id' | 'studentId' | 'day' | 'time'>,
): Session {
  return {
    durationMinutes: 45,
    ...overrides,
  }
}

const ana = student({ id: 1, name: 'Ana Costa', phone: '51911111111' })
const bruno = student({ id: 2, name: 'Bruno', phone: '51922222222' })
const duda = student({ id: 3, name: 'Duda', phone: '1234' })
const carla = student({ id: 4, name: 'Carla', phone: '51933333333' })

const tuesday = [
  session({ id: 11, studentId: ana.id, day: 'ter', time: '07:00' }),
  session({ id: 12, studentId: bruno.id, day: 'ter', time: '05:30' }),
  session({ id: 13, studentId: duda.id, day: 'ter', time: '06:00' }),
]
const wednesday = [
  session({ id: 21, studentId: carla.id, day: 'qua', time: '08:00' }),
]

function reminderPattern(name: string, dayLabel: string, clock: string): RegExp {
  const dayLower = dayLabel.toLocaleLowerCase('pt-BR')
  const withProf = ' com o prof Jean'
  const cores = [
    `Aula ${dayLower} às ${clock}${withProf}`,
    `${dayLabel} às ${clock}${withProf}`,
    `Te espero ${dayLower} às ${clock}`,
  ].map((core) => core.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(
    `^(Oi|Olá|Fala), ${name}\\. (${cores.join('|')})\\. (Me avisa se remarcar|Se precisar remarcar, me chama)\\.$`,
  )
}

function renderPage() {
  return render(
    <WhatsAppPage
      students={[ana, bruno, duda, carla]}
      sessions={[...tuesday, ...wednesday]}
    />,
  )
}

async function openConnectedPage() {
  renderPage()
  await screen.findByText('WhatsApp conectado')
  await waitFor(() => {
    const value = (
      screen.getByRole('textbox', { name: 'Mensagem para Bruno' }) as HTMLTextAreaElement
    ).value
    expect(value).toMatch(reminderPattern('Bruno', 'Terça', '5:30h'))
  })
}

beforeEach(() => {
  vi.mocked(fetchWhatsAppStatus).mockResolvedValue({
    status: 'connected',
    qr: null,
  })
  vi.mocked(sendWhatsAppOne).mockResolvedValue({ ok: true })
  vi.mocked(fetchProfessor).mockResolvedValue({
    name: 'Jean',
    phone: '51999999999',
  })
})

it('lista só as aulas do dia, marcadas e com o texto gerado', async () => {
  await openConnectedPage()

  expect(screen.getByText(/2 selecionadas de 3 para Terça/)).toBeInTheDocument()
  expect(screen.getByText(/15–30 segundos/)).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Mensagem para Carla' })).not.toBeInTheDocument()

  const messages = screen.getAllByRole('textbox', { name: /Mensagem para/ })
  expect(messages.map((field) => field.getAttribute('aria-label'))).toEqual([
    'Mensagem para Bruno',
    'Mensagem para Duda',
    'Mensagem para Ana Costa',
  ])

  expect(screen.getByRole('checkbox', { name: 'Incluir Bruno no envio' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'Incluir Ana Costa no envio' })).toBeChecked()
  expect(
    (screen.getByRole('textbox', { name: 'Mensagem para Bruno' }) as HTMLTextAreaElement)
      .value,
  ).toMatch(reminderPattern('Bruno', 'Terça', '5:30h'))
  expect(
    (screen.getByRole('textbox', { name: 'Mensagem para Ana Costa' }) as HTMLTextAreaElement)
      .value,
  ).toMatch(reminderPattern('Ana', 'Terça', '7h'))
  expect(screen.getByText(/Ana Costa/)).toBeInTheDocument()
})

it('deixa editar a mensagem e ignora telefone inválido no lote', async () => {
  const user = userEvent.setup()
  await openConnectedPage()

  const brunoMessage = screen.getByRole('textbox', { name: 'Mensagem para Bruno' })
  await user.clear(brunoMessage)
  await user.type(brunoMessage, 'Oi, Bruno. Te espero às 5:30.')

  expect(brunoMessage).toHaveValue('Oi, Bruno. Te espero às 5:30.')
  expect(screen.getByText('Telefone incompleto — edite o aluno (DDD + número)')).toBeInTheDocument()
  expect(screen.getByRole('checkbox', { name: 'Incluir Duda no envio' })).toBeChecked()
  expect(screen.getByText(/2 selecionadas de 3 para Terça/)).toBeInTheDocument()
  expect(screen.getByText(/15–30 segundos/)).toBeInTheDocument()
})

it('seleciona e desmarca todas, e fica no meio quando a escolha é parcial', async () => {
  const user = userEvent.setup()
  await openConnectedPage()

  const selectAll = screen.getByRole('checkbox', {
    name: 'Selecionar todas as mensagens',
  })
  const ana = screen.getByRole('checkbox', { name: 'Incluir Ana Costa no envio' })
  const bruno = screen.getByRole('checkbox', { name: 'Incluir Bruno no envio' })
  const send = screen.getByRole('button', { name: 'Enviar agora' })

  expect(selectAll).toBeChecked()
  expect(send).toBeEnabled()

  await user.click(ana)
  expect(selectAll).toBePartiallyChecked()
  expect(screen.getByText(/1 selecionadas de 3 para Terça/)).toBeInTheDocument()

  await user.click(selectAll)
  expect(ana).toBeChecked()
  expect(bruno).toBeChecked()
  expect(screen.getByText(/2 selecionadas de 3 para Terça/)).toBeInTheDocument()
  expect(screen.getByText(/15–30 segundos/)).toBeInTheDocument()

  await user.click(selectAll)
  expect(ana).not.toBeChecked()
  expect(bruno).not.toBeChecked()
  expect(screen.getByText(/0 selecionadas de 3 para Terça/)).toBeInTheDocument()
  expect(send).toBeDisabled()
})

it('descarta a edição ao trocar o dia e volta tudo marcado', async () => {
  const user = userEvent.setup()
  await openConnectedPage()

  const brunoMessage = screen.getByRole('textbox', { name: 'Mensagem para Bruno' })
  await user.clear(brunoMessage)
  await user.type(brunoMessage, 'Texto que não deve permanecer')
  await user.click(screen.getByRole('checkbox', { name: 'Incluir Bruno no envio' }))

  await user.selectOptions(screen.getByLabelText('Dia da semana'), 'qua')
  expect(
    (screen.getByRole('textbox', { name: 'Mensagem para Carla' }) as HTMLTextAreaElement)
      .value,
  ).toMatch(reminderPattern('Carla', 'Quarta', '8h'))
  expect(screen.getByRole('checkbox', { name: 'Incluir Carla no envio' })).toBeChecked()

  await user.selectOptions(screen.getByLabelText('Dia da semana'), 'ter')
  const restored = (
    screen.getByRole('textbox', { name: 'Mensagem para Bruno' }) as HTMLTextAreaElement
  ).value
  expect(restored).not.toBe('Texto que não deve permanecer')
  expect(restored).toMatch(reminderPattern('Bruno', 'Terça', '5:30h'))
  expect(screen.getByRole('checkbox', { name: 'Incluir Bruno no envio' })).toBeChecked()
})

it('envia só as mensagens marcadas e válidas, com o texto editado', async () => {
  const user = userEvent.setup()
  await openConnectedPage()

  const brunoMessage = screen.getByRole('textbox', { name: 'Mensagem para Bruno' })
  await user.clear(brunoMessage)
  await user.type(brunoMessage, 'Oi, Bruno. Te espero às 5:30.')
  await user.click(screen.getByRole('checkbox', { name: 'Incluir Ana Costa no envio' }))

  await user.click(screen.getByRole('button', { name: 'Enviar agora' }))

  await waitFor(() => {
    expect(sendWhatsAppOne).toHaveBeenCalledTimes(1)
  })
  expect(sendWhatsAppOne).toHaveBeenCalledWith(
    {
      name: 'Bruno',
      phone: toWhatsAppPhone(bruno.phone),
      text: 'Oi, Bruno. Te espero às 5:30.',
    },
    expect.any(AbortSignal),
  )

  expect(screen.getByRole('textbox', { name: 'Mensagem para Bruno' })).toHaveAttribute(
    'readonly',
  )
  expect(screen.getByRole('checkbox', { name: 'Incluir Bruno no envio' })).toBeDisabled()
  expect(screen.getByRole('textbox', { name: 'Mensagem para Ana Costa' })).not.toHaveAttribute(
    'readonly',
  )
})

it('trava a seleção e o texto enquanto o envio está em andamento', async () => {
  const user = userEvent.setup()
  let finishSend: (result: { ok: true }) => void = () => {}
  vi.mocked(sendWhatsAppOne).mockImplementation(
    () =>
      new Promise((resolve) => {
        finishSend = resolve
      }),
  )
  await openConnectedPage()

  await user.click(screen.getByRole('checkbox', { name: 'Incluir Ana Costa no envio' }))
  await user.click(screen.getByRole('button', { name: 'Enviar agora' }))

  await waitFor(() => {
    expect(
      screen.getByRole('checkbox', { name: 'Selecionar todas as mensagens' }),
    ).toBeDisabled()
  })
  expect(screen.getByRole('textbox', { name: 'Mensagem para Bruno' })).toHaveAttribute(
    'readonly',
  )
  expect(screen.getByRole('checkbox', { name: 'Incluir Ana Costa no envio' })).toBeDisabled()

  finishSend({ ok: true })
  await waitFor(() => {
    expect(screen.getByRole('checkbox', { name: 'Incluir Ana Costa no envio' })).toBeEnabled()
  })
  expect(screen.getByRole('textbox', { name: 'Mensagem para Bruno' })).toHaveAttribute(
    'readonly',
  )
})
