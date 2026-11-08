import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import type { ClassWeek as ClassWeekData } from '../types'
import { ClassWeek } from './ClassWeek'

const week: ClassWeekData = {
  weekStart: '2026-11-02',
  today: '2026-11-07',
  nowTime: '09:00',
  modalities: {
    hyrox: {
      days: [
        {
          date: '2026-11-02',
          day: 'seg',
          workout: 'Fran 21-15-9',
          slots: [
            {
              id: 1,
              time: '07:00',
              capacity: 2,
              canJoin: false,
              canLeave: false,
              myCheckinId: null,
              checkins: [
                { id: 10, studentName: 'Ana', mine: false },
                { id: 11, studentName: 'Bia', mine: false },
              ],
            },
          ],
        },
      ],
    },
    crossfit: {
      days: [
        {
          date: '2026-11-03',
          day: 'ter',
          workout: 'Corrida',
          slots: [
            {
              id: 2,
              time: '18:00',
              capacity: 10,
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
}

beforeEach(() => {
  localStorage.clear()
})

it('mostra o treino, quem já entrou e troca de modalidade', async () => {
  const user = userEvent.setup()
  const onModality = vi.fn()
  render(
    <ClassWeek
      week={week}
      modality="hyrox"
      onModality={onModality}
      onShiftWeek={() => {}}
      onCheckIn={() => Promise.resolve()}
      onCancel={() => Promise.resolve()}
      busyId={null}
    />,
  )

  expect(screen.getByRole('tab', { name: 'Hyrox' })).toHaveAttribute('aria-selected', 'true')
  expect(screen.getByText('07:00')).toBeInTheDocument()
  expect(screen.getByText('2/2')).toBeInTheDocument()
  expect(screen.getByText('Ana')).toBeInTheDocument()
  expect(screen.getByText('Bia')).toBeInTheDocument()
  expect(screen.getByText('Confirmados')).toBeInTheDocument()
  expect(screen.getByText('Lotado')).toBeInTheDocument()
  expect(screen.queryByText('Fran 21-15-9')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Ver treino completo' }))
  expect(screen.getByText('Fran 21-15-9')).toBeInTheDocument()

  await user.click(screen.getByRole('tab', { name: 'Crossfit' }))
  expect(onModality).toHaveBeenCalledWith('crossfit')
})

it('mostra os chips do resumo e o treino completo no olho', async () => {
  const user = userEvent.setup()
  render(
    <ClassWeek
      week={{
        ...week,
        modalities: {
          crossfit: {
            days: [
              {
                ...week.modalities.crossfit!.days[0],
                workout: 'Resumo: snatch · corda\n\nCorrida 5 km',
              },
            ],
          },
        },
      }}
      modality="crossfit"
      onModality={() => {}}
      onShiftWeek={() => {}}
      onCheckIn={() => Promise.resolve()}
      onCancel={() => Promise.resolve()}
      busyId={null}
    />,
  )

  expect(screen.getByText('snatch')).toBeInTheDocument()
  expect(screen.getByText('corda')).toBeInTheDocument()
  expect(screen.queryByText('Corrida 5 km')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Ver treino completo' }))
  expect(screen.getByText('Corrida 5 km')).toBeInTheDocument()
})

it('mostra o treino do dia mesmo sem horário de aula', () => {
  render(
    <ClassWeek
      week={{
        ...week,
        modalities: {
          crossfit: {
            days: [
              {
                date: '2026-11-10',
                day: 'ter',
                workout: 'Resumo: Clean · Corda\n\nForça',
                slots: [],
              },
            ],
          },
        },
      }}
      modality="crossfit"
      onModality={() => {}}
      onShiftWeek={() => {}}
      onCheckIn={() => Promise.resolve()}
      onCancel={() => Promise.resolve()}
      busyId={null}
    />,
  )

  expect(screen.getByRole('heading', { name: 'Terça' })).toBeInTheDocument()
  expect(screen.getByText('Clean')).toBeInTheDocument()
  expect(screen.getByText('Corda')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Ver treino completo' })).toBeInTheDocument()
  expect(screen.getByText('Nenhum horário neste dia.')).toBeInTheDocument()
})

it('entra na aula quando o horário tem vaga', async () => {
  const user = userEvent.setup()
  const onCheckIn = vi.fn()
  render(
    <ClassWeek
      week={week}
      modality="crossfit"
      onModality={() => {}}
      onShiftWeek={() => {}}
      onCheckIn={onCheckIn}
      onCancel={() => Promise.resolve()}
      busyId={null}
    />,
  )

  expect(screen.queryByText('Corrida')).not.toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Ver treino completo' }))
  expect(screen.getByText('Corrida')).toBeInTheDocument()
  expect(screen.getByText('Ninguém ainda.')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Fazer check-in' }))
  expect(onCheckIn).toHaveBeenCalledWith(2, '2026-11-03')
})

it('só deixa ir da semana atual para a seguinte', () => {
  const { rerender } = render(
    <ClassWeek
      week={week}
      modality="crossfit"
      onModality={() => {}}
      onShiftWeek={() => {}}
      onCheckIn={() => Promise.resolve()}
      onCancel={() => Promise.resolve()}
      busyId={null}
    />,
  )

  expect(screen.queryByRole('button', { name: 'Semana anterior' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Próxima semana' })).toBeInTheDocument()

  rerender(
    <ClassWeek
      week={{ ...week, weekStart: '2026-11-09' }}
      modality="crossfit"
      onModality={() => {}}
      onShiftWeek={() => {}}
      onCheckIn={() => Promise.resolve()}
      onCancel={() => Promise.resolve()}
      busyId={null}
    />,
  )

  expect(screen.getByRole('button', { name: 'Semana anterior' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Próxima semana' })).not.toBeInTheDocument()
})

it('esconde a outra modalidade quando o aluno só faz Crossfit', () => {
  render(
    <ClassWeek
      week={{ ...week, modalities: { crossfit: week.modalities.crossfit } }}
      modality="crossfit"
      onModality={() => {}}
      onShiftWeek={() => {}}
      onCheckIn={() => Promise.resolve()}
      onCancel={() => Promise.resolve()}
      busyId={null}
    />,
  )

  expect(screen.queryByRole('tab', { name: 'Hyrox' })).not.toBeInTheDocument()
  expect(screen.queryByRole('tab', { name: 'Crossfit' })).not.toBeInTheDocument()
  expect(screen.getByText('18:00')).toBeInTheDocument()
  expect(screen.queryByText('07:00')).not.toBeInTheDocument()
})
