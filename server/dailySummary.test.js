import { expect, it } from 'vitest'
import {
  addIsoDays,
  buildSummaryText,
  isSummaryDue,
  runDailySummaries,
  saoPauloClock,
  weekdayId,
} from './dailySummary.js'

it('lê 21h no horário de Brasília', () => {
  const clock = saoPauloClock(new Date('2026-10-05T00:00:00Z'))
  expect(clock).toEqual({ date: '2026-10-04', hour: 21 })
})

it('sabe o dia seguinte e o dia da semana', () => {
  expect(addIsoDays('2026-10-04', 1)).toBe('2026-10-05')
  expect(weekdayId('2026-10-05')).toBe('seg')
  expect(addIsoDays('2026-10-31', 1)).toBe('2026-11-01')
})

it('só considera o resumo devido depois das 21h e uma vez por dia', () => {
  expect(isSummaryDue({ hour: 20, today: '2026-10-04', lastSummaryOn: null })).toBe(
    false,
  )
  expect(isSummaryDue({ hour: 21, today: '2026-10-04', lastSummaryOn: null })).toBe(
    true,
  )
  expect(
    isSummaryDue({
      hour: 22,
      today: '2026-10-04',
      lastSummaryOn: '2026-10-04',
    }),
  ).toBe(false)
  expect(
    isSummaryDue({
      hour: 21,
      today: '2026-10-05',
      lastSummaryOn: '2026-10-04',
    }),
  ).toBe(true)
})

it('monta o resumo com aulas agrupadas e o aviso de dia vazio', () => {
  expect(
    buildSummaryText('Terça', [
      { time: '06:00', name: 'Cloris' },
      { time: '05:30', name: 'Honório' },
      { time: '05:30', name: 'Ana' },
    ]),
  ).toBe('Agenda de amanhã — Terça\n\n05:30 Ana, Honório\n06:00 Cloris')

  expect(buildSummaryText('Quarta', [])).toBe(
    'Agenda de amanhã — Quarta\n\nNão tem aulas.',
  )
})

it('pula o professor cujo WhatsApp não está conectado', async () => {
  const updates = []
  const db = {
    from(table) {
      if (table === 'professor_settings') {
        return {
          select: async () => ({
            data: [
              {
                user_id: 'offline',
                whatsapp_phone: '51999999999',
                last_summary_on: null,
              },
              {
                user_id: 'online',
                whatsapp_phone: '51988888888',
                last_summary_on: null,
              },
            ],
            error: null,
          }),
          update(patch) {
            return {
              eq(_column, userId) {
                updates.push(userId)
                return Promise.resolve({ error: null })
              },
            }
          },
        }
      }
      return {
        select: () => ({
          eq: () => ({
            eq: async () => ({ data: [], error: null }),
          }),
        }),
      }
    },
  }

  const sent = []
  const result = await runDailySummaries({
    db,
    now: new Date('2026-10-05T00:00:00Z'),
    sendForUser: async (userId) => {
      if (userId === 'offline') return false
      sent.push(userId)
      return true
    },
  })

  expect(result.sent).toBe(1)
  expect(sent).toEqual(['online'])
  expect(updates).toEqual(['online'])
})
