import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import {
  fetchWhatsAppStatus,
  sendWhatsAppOne,
  toWhatsAppPhone,
} from '../api/whatsapp'
import type { Session, Student } from '../types'
import { WhatsAppPage } from './WhatsAppPage'

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

const ana = student({ id: 1, name: 'Ana', phone: '51911111111' })
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
}

beforeEach(() => {
  vi.mocked(fetchWhatsAppStatus).mockResolvedValue({
    status: 'connected',
    qr: null,
  })
  vi.mocked(sendWhatsAppOne).mockResolvedValue({ ok: true })
})

it('lista só as aulas do dia, marcadas e com o texto gerado', async () => {
  await openConnectedPage()

  expect(screen.getByText('2 selecionadas de 3 para Terça')).toBeInTheDocument()
  expect(screen.queryByRole('textbox', { name: 'Mensagem para Carla' })).not.toBeInTheDocument()

  const messages = screen.getAllByRole('textbox')
  expect(messages.map((field) => field.getAttribute('aria-label'))).toEqual([
    'Mensagem para Bruno',
    'Mensagem para Duda',
    'Mensagem para Ana',
  ])

  expect(screen.getByRole('checkbox', { name: 'Incluir Bruno no envio' })).toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'Incluir Ana no envio' })).toBeChecked()
  expect(screen.getByRole('textbox', { name: 'Mensagem para Bruno' })).toHaveValue(
    'Olá, Bruno. Sua aula com o prof Jean está agendada para Terça às 05:30h. Avise se precisar remarcar. Até lá! 👊',
  )
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
  expect(screen.getByText('2 selecionadas de 3 para Terça')).toBeInTheDocument()
})

it('seleciona e desmarca todas, e fica no meio quando a escolha é parcial', async () => {
  const user = userEvent.setup()
  await openConnectedPage()

  const selectAll = screen.getByRole('checkbox', {
    name: 'Selecionar todas as mensagens',
  })
  const ana = screen.getByRole('checkbox', { name: 'Incluir Ana no envio' })
  const bruno = screen.getByRole('checkbox', { name: 'Incluir Bruno no envio' })
  const send = screen.getByRole('button', { name: 'Enviar agora' })

  expect(selectAll).toBeChecked()
  expect(send).toBeEnabled()

  await user.click(ana)
  expect(selectAll).toBePartiallyChecked()
  expect(screen.getByText('1 selecionadas de 3 para Terça')).toBeInTheDocument()

  await user.click(selectAll)
  expect(ana).toBeChecked()
  expect(bruno).toBeChecked()
  expect(screen.getByText('2 selecionadas de 3 para Terça')).toBeInTheDocument()

  await user.click(selectAll)
  expect(ana).not.toBeChecked()
  expect(bruno).not.toBeChecked()
  expect(screen.getByText('0 selecionadas de 3 para Terça')).toBeInTheDocument()
  expect(send).toBeDisabled()
})

it('descarta a edição ao trocar o dia e volta tudo marcado', async () => {
  const user = userEvent.setup()
  await openConnectedPage()

  const brunoMessage = screen.getByRole('textbox', { name: 'Mensagem para Bruno' })
  const original = (brunoMessage as HTMLTextAreaElement).value
  await user.clear(brunoMessage)
  await user.type(brunoMessage, 'Texto que não deve permanecer')
  await user.click(screen.getByRole('checkbox', { name: 'Incluir Bruno no envio' }))

  await user.selectOptions(screen.getByLabelText('Dia da semana'), 'qua')
  expect(screen.getByRole('textbox', { name: 'Mensagem para Carla' })).toHaveValue(
    'Olá, Carla. Sua aula com o prof Jean está agendada para Quarta às 08:00h. Avise se precisar remarcar. Até lá! 👊',
  )
  expect(screen.getByRole('checkbox', { name: 'Incluir Carla no envio' })).toBeChecked()

  await user.selectOptions(screen.getByLabelText('Dia da semana'), 'ter')
  expect(screen.getByRole('textbox', { name: 'Mensagem para Bruno' })).toHaveValue(original)
  expect(screen.getByRole('checkbox', { name: 'Incluir Bruno no envio' })).toBeChecked()
})

it('envia só as mensagens marcadas e válidas, com o texto editado', async () => {
  const user = userEvent.setup()
  await openConnectedPage()

  const brunoMessage = screen.getByRole('textbox', { name: 'Mensagem para Bruno' })
  await user.clear(brunoMessage)
  await user.type(brunoMessage, 'Oi, Bruno. Te espero às 5:30.')
  await user.click(screen.getByRole('checkbox', { name: 'Incluir Ana no envio' }))

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
  expect(screen.getByRole('textbox', { name: 'Mensagem para Ana' })).not.toHaveAttribute(
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

  await user.click(screen.getByRole('checkbox', { name: 'Incluir Ana no envio' }))
  await user.click(screen.getByRole('button', { name: 'Enviar agora' }))

  await waitFor(() => {
    expect(
      screen.getByRole('checkbox', { name: 'Selecionar todas as mensagens' }),
    ).toBeDisabled()
  })
  expect(screen.getByRole('textbox', { name: 'Mensagem para Bruno' })).toHaveAttribute(
    'readonly',
  )
  expect(screen.getByRole('checkbox', { name: 'Incluir Ana no envio' })).toBeDisabled()

  finishSend({ ok: true })
  await waitFor(() => {
    expect(screen.getByRole('checkbox', { name: 'Incluir Ana no envio' })).toBeEnabled()
  })
  expect(screen.getByRole('textbox', { name: 'Mensagem para Bruno' })).toHaveAttribute(
    'readonly',
  )
})
