import { describe, expect, it } from 'vitest'
import type { Payment, PlanPrice, Session, Student } from '../types'
import { computeBusinessStats, buildMonthSeries, monthsBetween } from './stats'

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

const month = '2026-10'
const today = '2026-10-08'

describe('computeBusinessStats', () => {
  it('soma só alunos ativos e ignora valor combinado na defasagem', () => {
    const students = [
      student({ id: 1, name: 'Ana', planValue: 200, weeklyClasses: 2 }),
      student({
        id: 2,
        name: 'Bruno',
        planValue: 100,
        weeklyClasses: 2,
        startedOn: '2026-10-01',
      }),
      student({
        id: 3,
        name: 'Carla',
        planValue: 80,
        weeklyClasses: 2,
        customPrice: true,
      }),
      student({ id: 4, name: 'Diego', status: 'pausado', planValue: 900 }),
      student({
        id: 5,
        name: 'Elena',
        status: 'encerrado',
        planValue: 700,
        endedOn: '2026-10-02',
        startedOn: '2024-01-10',
      }),
    ]
    const planPrices: PlanPrice[] = [{ weeklyClasses: 2, amount: 150 }]
    const stats = computeBusinessStats({
      students,
      sessions: [],
      payments: [],
      planPrices,
      month,
      today,
    })

    expect(stats.revenue).toBe(380)
    expect(stats.activeCount).toBe(3)
    expect(stats.pausedCount).toBe(1)
    expect(stats.outdated.map((item) => item.student.name)).toEqual(['Bruno'])
    expect(stats.reajusteGap).toBe(50)
    expect(stats.newCount).toBe(1)
    expect(stats.exitCount).toBe(1)
    expect(stats.retention).toEqual({ stayed: 3, base: 4 })
  })

  it('marca atraso só depois do vencimento e separa o recebido', () => {
    const ana = student({ id: 1, name: 'Ana' })
    const bruno = student({ id: 2, name: 'Bruno', planValue: 100 })
    const payments: Payment[] = [
      {
        id: 1,
        studentId: 1,
        competence: month,
        amount: 200,
        dueOn: '2026-10-05',
        paidOn: null,
      },
      {
        id: 2,
        studentId: 2,
        competence: month,
        amount: 100,
        dueOn: today,
        paidOn: null,
      },
    ]
    const stats = computeBusinessStats({
      students: [ana, bruno],
      sessions: [],
      payments,
      planPrices: [],
      month,
      today,
    })

    expect(stats.overdueCount).toBe(1)
    expect(stats.overdueAmount).toBe(200)
    expect(stats.expected).toBe(300)
    expect(stats.received).toBe(0)
    expect(stats.openPayments.map((item) => [item.student.name, item.late])).toEqual([
      ['Ana', true],
      ['Bruno', false],
    ])
  })

  it('mede pico, buraco e ocupação dentro da janela de cada dia', () => {
    const ana = student({ id: 1, name: 'Ana', weeklyClasses: 3 })
    const sessions: Session[] = [
      { id: 1, studentId: 1, day: 'seg', time: '07:00', durationMinutes: 45 },
      { id: 2, studentId: 1, day: 'seg', time: '08:00', durationMinutes: 45 },
      { id: 3, studentId: 1, day: 'ter', time: '07:00', durationMinutes: 45 },
      { id: 4, studentId: 9, day: 'dom', time: '10:00', durationMinutes: 45 },
    ]
    const stats = computeBusinessStats({
      students: [ana],
      sessions,
      payments: [],
      planPrices: [],
      month,
      today,
    })

    expect(stats.peakTimes[0]).toEqual({ time: '07:00', count: 2 })
    expect(stats.emptySlots).toEqual([{ day: 'seg', time: '07:30' }])
    expect(stats.sessionCount).toBe(3)
    expect(stats.slotCount).toBe(4)
    expect(stats.occupancy).toBeCloseTo(0.75)
    expect(stats.incomplete).toEqual([])
  })

  it('divide a mensalidade pelas aulas do mês, não pelas vezes na semana', () => {
    const ana = student({ id: 1, name: 'Ana', planValue: 200, weeklyClasses: 2 })
    const stats = computeBusinessStats({
      students: [ana],
      sessions: [],
      payments: [],
      planPrices: [],
      month,
      today,
    })

    expect(stats.revenuePerClass).toBe(22.58)
  })

  it('conta meses completos de casa', () => {
    expect(monthsBetween('2025-01-10', '2026-10-08')).toBe(20)
    expect(monthsBetween('2026-10-01', '2026-10-08')).toBe(0)
  })
})

describe('buildMonthSeries', () => {
  it('congela a renda do mês passado e deixa buraco onde não houve registro', () => {
    const ana = student({ id: 1, name: 'Ana', planValue: 200, startedOn: '2026-08-02' })
    const bruno = student({
      id: 2,
      name: 'Bruno',
      planValue: 999,
      status: 'pausado',
      startedOn: '2026-07-01',
    })
    const payments: Payment[] = [
      {
        id: 1,
        studentId: 1,
        competence: '2026-09',
        amount: 150,
        dueOn: '2026-09-05',
        paidOn: '2026-09-05',
      },
      {
        id: 2,
        studentId: 1,
        competence: '2026-10',
        amount: 10,
        dueOn: '2026-10-05',
        paidOn: null,
      },
    ]

    const september = computeBusinessStats({
      students: [ana, bruno],
      sessions: [],
      payments,
      planPrices: [],
      month: '2026-09',
      today,
    })
    expect(september.revenue).toBe(150)
    expect(september.received).toBe(150)
    expect(september.activeCount).toBe(2)
    expect(september.pausedCount).toBe(1)
    expect(september.outdated).toEqual([])

    const august = computeBusinessStats({
      students: [ana, bruno],
      sessions: [],
      payments,
      planPrices: [],
      month: '2026-08',
      today,
    })
    expect(august.revenue).toBeNull()
    expect(august.received).toBeNull()
    expect(august.activeCount).toBe(2)

    const series = buildMonthSeries({
      students: [ana, bruno],
      payments,
      today,
    })
    const byMonth = new Map(series.map((point) => [point.month, point]))
    expect(series[0]?.month).toBe('2026-07')
    expect(series.at(-1)?.month).toBe('2026-10')
    expect(byMonth.get('2026-08')?.revenue).toBeNull()
    expect(byMonth.get('2026-09')?.revenue).toBe(150)
    expect(byMonth.get('2026-10')?.revenue).toBe(200)
    expect(byMonth.get('2026-10')?.activeCount).toBe(1)
  })
})
