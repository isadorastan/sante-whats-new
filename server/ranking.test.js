import { expect, it } from 'vitest'
import { rankCheckins } from './ranking.js'

const today = '2026-11-07'

it('ordena por check-ins, ignora aula futura e marca o aluno', () => {
  const rows = rankCheckins(
    [
      { studentId: 1, name: 'Bia', classOn: '2026-11-02' },
      { studentId: 2, name: 'Ana', classOn: '2026-11-03' },
      { studentId: 2, name: 'Ana', classOn: '2026-11-04' },
      { studentId: 1, name: 'Bia', classOn: '2026-11-20' },
    ],
    { today, month: null, studentId: 2 },
  )

  expect(rows).toEqual([
    { rank: 1, name: 'Ana', count: 2, mine: true },
    { rank: 2, name: 'Bia', count: 1, mine: false },
  ])
})

it('no mês ignora outro mês e desempata pelo nome', () => {
  const rows = rankCheckins(
    [
      { studentId: 1, name: 'Caio', classOn: '2026-10-20' },
      { studentId: 2, name: 'Bia', classOn: '2026-11-02' },
      { studentId: 3, name: 'Ana', classOn: '2026-11-03' },
      { studentId: 3, name: 'Ana', classOn: '2026-12-01' },
    ],
    { today, month: '2026-11', studentId: 9 },
  )

  expect(rows).toEqual([
    { rank: 1, name: 'Ana', count: 1, mine: false },
    { rank: 2, name: 'Bia', count: 1, mine: false },
  ])
})
