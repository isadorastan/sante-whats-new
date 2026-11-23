import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { setToken } from '../api/http'
import { inviteWhatsAppUrl, SlotInvites } from './ClassInvites'

const invite = {
  id: 4,
  fromStudentId: 1,
  fromName: 'Lia',
  toStudentId: 2,
  toName: 'Ana',
  slotId: 9,
  classOn: '2026-11-25',
  modality: 'crossfit' as const,
  day: 'qua' as const,
  time: '07:00',
  status: 'pending' as const,
}

beforeEach(() => {
  localStorage.clear()
  setToken('test-token')
})

it('abre o WhatsApp no convite pendente para encaminhar a mensagem', async () => {
  const user = userEvent.setup()
  const open = vi.spyOn(window, 'open').mockImplementation(() => null)
  const sent = { ...invite, id: 8, toStudentId: 3, toName: 'jean bisogno' }
  render(
    <SlotInvites
      slotId={9}
      date="2026-11-25"
      day="qua"
      time="07:00"
      modality="crossfit"
      invites={{
        classmates: [{ id: 3, name: 'jean bisogno', crossfit: true, hyrox: false }],
        sent: [sent],
        received: [],
      }}
      onChanged={() => {}}
    />,
  )

  await user.click(screen.getByRole('button', { name: 'Convidar amigo' }))
  expect(screen.getByRole('dialog', { name: 'Convidar amigo' })).toBeInTheDocument()
  expect(open).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Enviar convite para jean bisogno no WhatsApp' }))

  expect(open).toHaveBeenCalledWith(inviteWhatsAppUrl(sent), '_blank', 'noopener,noreferrer')
  const text = decodeURIComponent(inviteWhatsAppUrl(sent))
  expect(text).toContain('Oi jean bisogno!')
  expect(text).toContain('Crossfit - Qua 25/11 07:00')
  expect(text).toContain('https://ctfsante.com.br/aluno')
})

it('mantém o convite pendente quando a aula está lotada', async () => {
  const user = userEvent.setup()
  const onChanged = vi.fn()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      return new Response(JSON.stringify({ error: 'Horário lotado' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    }),
  )

  render(
    <SlotInvites
      slotId={9}
      date="2026-11-25"
      day="qua"
      time="07:00"
      modality="crossfit"
      invites={{ classmates: [], sent: [], received: [invite] }}
      onChanged={onChanged}
    />,
  )

  await user.click(screen.getByRole('button', { name: 'Aceitar' }))
  await user.click(screen.getByRole('button', { name: 'Confirmar' }))

  expect(await screen.findAllByText('Horário lotado')).toHaveLength(2)
  expect(screen.getByRole('dialog', { name: 'Confirmar check-in' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Aceitar' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Recusar' })).toBeInTheDocument()
  expect(screen.queryByText('Aceito')).not.toBeInTheDocument()
  expect(onChanged).not.toHaveBeenCalled()
})
