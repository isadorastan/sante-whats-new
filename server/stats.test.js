import { expect, it } from 'vitest'
import { addIsoDays } from './dailySummary.js'
import { weekStartMonday } from './classRules.js'
import { summarizeCheckins } from './stats.js'

const today = '2026-11-22'
const weekStart = weekStartMonday(today)

it('conta total, mês, semana e modalidades, e ignora aula futura', () => {
  const summary = summarizeCheckins(
    [
      { classOn: '2026-11-23', modality: 'crossfit' },
      { classOn: '2026-11-18', modality: 'crossfit' },
      { classOn: '2026-11-18', modality: 'hyrox' },
      { classOn: '2026-11-02', modality: 'hyrox' },
      { classOn: '2026-10-05', modality: 'crossfit' },
      { classOn: '2024-01-02', modality: 'hyrox' },
    ],
    { today, month: '2026-11', weekStart },
  )

  expect(weekStart).toBe('2026-11-16')
  expect(summary).toMatchObject({
    total: 5,
    month: 3,
    week: 2,
    firstOn: '2024-01-02',
    crossfit: 2,
    hyrox: 3,
    from: addIsoDays(weekStart, -52 * 7),
    today,
  })
  expect(summary.from).toBe('2025-11-17')
  expect(summary.days).toEqual([
    { date: '2024-01-02', count: 1 },
    { date: '2026-10-05', count: 1 },
    { date: '2026-11-02', count: 1 },
    { date: '2026-11-18', count: 2 },
  ])
})

it('sem check-in devolve zeros e nenhum primeiro dia', () => {
  expect(summarizeCheckins([], { today, month: '2026-11', weekStart })).toMatchObject({
    total: 0,
    month: 0,
    week: 0,
    firstOn: null,
    crossfit: 0,
    hyrox: 0,
    days: [],
  })
})
