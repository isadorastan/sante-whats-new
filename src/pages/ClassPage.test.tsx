import { act, render, screen, waitFor } from '@testing-library/react'
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
          {
            id: 1,
            name: 'Ana',
            username: 'ana',
            phone: '(11) 98888-7766',
            crossfit: true,
            hyrox: false,
          },
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
      if (url.includes('/api/class/week')) {
        return json({
          weekStart: '2026-11-02',
          today: '2026-11-07',
          nowTime: '09:00',
          modalities: {
            crossfit: {
              days: [
                {
                  date: '2026-11-02',
                  day: 'seg',
                  workout: 'Fran',
                  slots: [
                    {
                      id: 4,
                      time: '07:00',
                      capacity: 12,
                      checkins: [{ id: 10, studentName: 'Ana', mine: false }],
                    },
                  ],
                },
              ],
            },
          },
        })
      }
      if (url.includes('/api/class/workouts/assist')) {
        return json({ text: 'Aquecimento\n3 rounds snatch' })
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
    expect(screen.getByText('ana · (11) 98888-7766')).toBeInTheDocument()
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

  await user.click(screen.getByRole('tab', { name: 'Check-in semanal' }))
  expect(await screen.findByRole('heading', { name: 'Segunda' })).toBeInTheDocument()
  expect(screen.getByText('Ana')).toBeInTheDocument()
  expect(screen.getByText('1/12')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Fazer check-in' })).not.toBeInTheDocument()
})

it('monta o treino com as predefinições e deixa editar a lista', async () => {
  localStorage.removeItem('sante-workout-presets-v1')
  const user = userEvent.setup()
  render(<ClassPage />)

  await user.click(screen.getByRole('tab', { name: 'Gestão de treinos' }))
  const expand = await screen.findAllByRole('button', { name: 'Expandir' })
  await user.click(expand[0])

  expect(screen.getByRole('heading', { name: 'Aquecimento' })).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'AMRAP' }))
  expect(screen.getAllByRole('textbox', { name: 'Treino' })[0]).toHaveValue('AMRAP')

  await user.click(screen.getByRole('button', { name: 'Remover AMRAP' }))
  expect(screen.queryByRole('button', { name: 'AMRAP' })).not.toBeInTheDocument()

  const input = screen.getByRole('textbox', { name: 'Novo item em Wods e formatos' })
  await user.type(input, 'CHIPPER{Enter}')
    expect(screen.getByRole('button', { name: 'CHIPPER' })).toBeInTheDocument()
  })

  it('gera o treino a partir do pedido escrito', async () => {
    const user = userEvent.setup()
    render(<ClassPage />)

    await user.click(await screen.findByRole('tab', { name: 'Gestão de treinos' }))
    await user.click((await screen.findAllByRole('button', { name: 'Expandir' }))[0])
    await user.type(
      screen.getByRole('textbox', { name: 'Pedir por escrito' }),
      'monte um aquecimento com snatch',
    )
    await user.click(screen.getByRole('button', { name: 'Gerar treino' }))

    await waitFor(() => {
      expect(screen.getAllByRole('textbox', { name: 'Treino' })[0]).toHaveValue(
        'Aquecimento\n3 rounds snatch',
      )
    })
    const assist = vi
      .mocked(fetch)
      .mock.calls.find((call) => String(call[0]).includes('/workouts/assist'))
    expect(JSON.parse(String((assist?.[1] as RequestInit).body))).toEqual({
      prompt: 'monte um aquecimento com snatch',
    })
  })

  it('coloca a fala no pedido e gera o mesmo treino', async () => {
    class FakeSpeech {
      static last: FakeSpeech
      lang = ''
      continuous = false
      interimResults = false
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null =
        null
      onerror: (() => void) | null = null
      onend: (() => void) | null = null
      start() {
        FakeSpeech.last = this
      }
      stop() {
        this.onend?.()
      }
    }
    vi.stubGlobal('webkitSpeechRecognition', FakeSpeech)
    const user = userEvent.setup()
    render(<ClassPage />)

    await user.click(await screen.findByRole('tab', { name: 'Gestão de treinos' }))
    await user.click((await screen.findAllByRole('button', { name: 'Expandir' }))[0])
    await user.click(screen.getByRole('button', { name: 'Falar' }))
    expect(screen.getByRole('button', { name: 'Ouvindo...' })).toBeInTheDocument()
    act(() => {
      FakeSpeech.last.onresult?.({ results: [[{ transcript: 'treino com snatch' }]] })
      FakeSpeech.last.onend?.()
    })

    expect(screen.getByRole('textbox', { name: 'Pedir por escrito' })).toHaveValue('treino com snatch')
    await user.click(screen.getByRole('button', { name: 'Gerar treino' }))
    await waitFor(() => {
      expect(screen.getAllByRole('textbox', { name: 'Treino' })[0]).toHaveValue(
        'Aquecimento\n3 rounds snatch',
      )
    })
  })

it('mostra carregando enquanto apaga um horário', async () => {
  let release: () => void = () => {}
  const pending = new Promise<void>((resolve) => {
    release = resolve
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'DELETE') {
        await pending
        return json({})
      }
      if (url.includes('/api/class/students')) {
        return json([])
      }
      if (url.includes('/api/class/attendance')) {
        return json({ month: '2026-11', scope: 'studio', rows: [] })
      }
      if (url.includes('/api/class/schedule')) {
        return json({
          modality: 'crossfit',
          days: ['seg'],
          slots: [{ id: 4, modality: 'crossfit', day: 'seg', time: '07:00', capacity: 12 }],
        })
      }
      return json({})
    }),
  )

  const user = userEvent.setup()
  render(<ClassPage />)
  await user.click(screen.getByRole('tab', { name: 'Gestão de horários' }))
  await user.click(await screen.findByRole('button', { name: 'Apagar' }))

  expect(await screen.findByRole('status')).toHaveTextContent('Carregando...')
  release()
  await waitFor(() => {
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})
