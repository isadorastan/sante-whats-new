import { useEffect, useMemo, useState } from 'react'
import {
  fetchAllPayments,
  fetchPayments,
  fetchPlanPrices,
  markPaymentPaid,
  markPaymentUnpaid,
} from '../api/data'
import { DAYS, type Payment, type PlanPrice, type Session, type Student } from '../types'
import {
  brazilMonth,
  brazilToday,
  formatIsoDate,
  formatMonthLabel,
  formatMonths,
  shiftMonth,
} from '../utils/dates'
import { formatCurrency } from '../utils/format'
import { computeBusinessStats, buildMonthSeries, earliestStatsMonth } from '../utils/stats'

interface StatsPageProps {
  students: Student[]
  sessions: Session[]
}

const EMPTY_PREVIEW = 8

type PaymentRowStatus = 'pago' | 'atrasado' | 'aberto'

const STATUS_LABEL: Record<PaymentRowStatus, string> = {
  pago: 'Pago',
  atrasado: 'Em atraso',
  aberto: 'Em aberto',
}

const STATUS_ORDER: Record<PaymentRowStatus, number> = {
  atrasado: 0,
  aberto: 1,
  pago: 3,
}

function paymentRowStatus(payment: Payment, today: string): PaymentRowStatus {
  if (payment.paidOn) return 'pago'
  if (payment.dueOn && payment.dueOn < today) return 'atrasado'
  return 'aberto'
}

function isAccumulatedArrear(payment: Payment, today: string, currentMonth: string): boolean {
  if (payment.paidOn) return false
  if (payment.competence < currentMonth) return true
  return Boolean(payment.dueOn && payment.dueOn < today)
}

const SHORT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function shortMonth(month: string): string {
  const [year, monthNumber] = month.split('-')
  return `${SHORT_MONTHS[Number(monthNumber) - 1]}/${year.slice(2)}`
}

function MonthBars({
  points,
  formatValue,
  label,
}: {
  points: { month: string; value: number | null }[]
  formatValue: (value: number) => string
  label: string
}) {
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null)
  const hovered = points.find((point) => point.month === hoveredMonth) ?? null
  const max = Math.max(1, ...points.map((point) => point.value ?? 0))
  const barWidth = 22
  const gap = 16
  const width = Math.max(points.length * (barWidth + gap) + 8, 220)
  const height = 148
  const hoveredText = hovered
    ? `${formatMonthLabel(hovered.month)} · ${
        hovered.value == null ? 'Sem registro' : formatValue(hovered.value)
      }`
    : 'Passe o mouse sobre um mês'

  return (
    <div className="stats-chart-wrap">
      <p className={`stats-chart__tip${hovered ? '' : ' stats-chart__tip--idle'}`}>{hoveredText}</p>
      <svg
        className="stats-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label}
        style={{ width }}
      >
        {points.map((point, index) => {
          const barHeight =
            point.value == null ? 0 : Math.max(2, (point.value / max) * 100)
          const x = index * (barWidth + gap) + 8
          const y = 112 - barHeight
          const hot = point.month === hoveredMonth
          return (
            <g
              key={point.month}
              onMouseEnter={() => setHoveredMonth(point.month)}
              onMouseLeave={() => setHoveredMonth(null)}
            >
              <rect
                x={x - gap / 2}
                y={0}
                width={barWidth + gap}
                height={height}
                fill="transparent"
              />
              {point.value != null ? (
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  rx="4"
                  className={`stats-chart__bar${hot ? ' is-hot' : ''}`}
                />
              ) : null}
              <text
                x={x + barWidth / 2}
                y={132}
                textAnchor="middle"
                className="stats-chart__label"
                fontSize="9"
              >
                {shortMonth(point.month)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`
}

export function StatsPage({ students, sessions }: StatsPageProps) {
  const currentMonth = brazilMonth()
  const today = brazilToday()
  const [month, setMonth] = useState(currentMonth)
  const [planPrices, setPlanPrices] = useState<PlanPrice[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [markingId, setMarkingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void Promise.all([
      fetchPlanPrices(),
      fetchPayments(currentMonth),
      fetchAllPayments(),
    ])
      .then(([prices, ensured, all]) => {
        if (cancelled) return
        const rest = all.filter((payment) => payment.competence !== currentMonth)
        setPlanPrices(prices)
        setPayments([...rest, ...ensured])
        setError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Falha ao carregar estatísticas')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [currentMonth])

  const stats = useMemo(
    () =>
      computeBusinessStats({
        students,
        sessions,
        payments,
        planPrices,
        month,
        today,
      }),
    [students, sessions, payments, planPrices, month, today],
  )

  const paymentRows = useMemo(() => {
    const byId = new Map(students.map((student) => [student.id, student]))
    return payments
      .flatMap((payment) => {
        if (payment.competence !== month) return []
        const student = byId.get(payment.studentId)
        if (!student) return []
        return [{ payment, student, status: paymentRowStatus(payment, today) }]
      })
      .sort(
        (a, b) =>
          STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
          (a.payment.dueOn ?? '9999-99-99').localeCompare(b.payment.dueOn ?? '9999-99-99') ||
          a.student.name.localeCompare(b.student.name, 'pt-BR'),
      )
  }, [students, payments, month, today])

  const series = useMemo(() => {
    const year = today.slice(0, 4)
    return buildMonthSeries({ students, payments, today }).filter((point) =>
      point.month.startsWith(`${year}-`),
    )
  }, [students, payments, today])

  const arrears = useMemo(() => {
    const byId = new Map(students.map((student) => [student.id, student]))
    return payments
      .flatMap((payment) => {
        if (!isAccumulatedArrear(payment, today, currentMonth)) return []
        const student = byId.get(payment.studentId)
        if (!student) return []
        return [{ payment, student }]
      })
      .sort(
        (a, b) =>
          a.student.name.localeCompare(b.student.name, 'pt-BR') ||
          a.payment.competence.localeCompare(b.payment.competence),
      )
  }, [students, payments, today, currentMonth])

  async function markPaid(payment: Payment) {
    if (markingId !== null) return
    setMarkingId(payment.id)
    setError(null)
    try {
      const updated = await markPaymentPaid(payment.studentId, payment.competence)
      setPayments((prev) =>
        prev.map((item) => (item.id === payment.id ? updated : item)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao marcar pagamento')
    } finally {
      setMarkingId(null)
    }
  }

  async function markUnpaid(payment: Payment) {
    if (markingId !== null) return
    setMarkingId(payment.id)
    setError(null)
    try {
      const updated = await markPaymentUnpaid(payment.studentId, payment.competence)
      setPayments((prev) =>
        prev.map((item) => (item.id === payment.id ? updated : item)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao desfazer pagamento')
    } finally {
      setMarkingId(null)
    }
  }

  const isCurrent = month === currentMonth
  const earliest = earliestStatsMonth(students, payments, currentMonth)
  const exitsInBase = stats.retention
    ? stats.retention.base - stats.retention.stayed
    : 0
  const retentionHint = stats.retention
    ? exitsInBase === 0
      ? `Nenhuma saída de ${stats.retention.base}`
      : `${exitsInBase} ${exitsInBase === 1 ? 'saída' : 'saídas'} de ${stats.retention.base}`
    : 'Informe a data de início para calcular'
  const startHint =
    stats.missingStartCount > 0
      ? `${formatCount(stats.missingStartCount, 'aluno sem data de início', 'alunos sem data de início')}`
      : null

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Estatísticas</h1>
          <p className="page-header__subtitle">Visão do studio e do mês</p>
        </div>
      </header>

      <div className="page-body stats-page">
        {error ? (
          <div className="whatsapp-banner whatsapp-banner--error">{error}</div>
        ) : null}
        {loading ? <p className="page-status">Carregando estatísticas...</p> : null}

        {!loading ? (
        <>
        <section className="stats-block" aria-labelledby="stats-overview">
          <h2 id="stats-overview" className="stats-section__title">
            Visão geral
          </h2>
          <div className="stats-dashboard">
            <div className="stats-dashboard__charts">
              <article className="stats-panel">
                <h3 className="stats-subtitle">Faturamento</h3>
                <MonthBars
                  label="Faturamento por mês"
                  formatValue={formatCurrency}
                  points={series.map((point) => ({ month: point.month, value: point.revenue }))}
                />
              </article>
              <article className="stats-panel">
                <h3 className="stats-subtitle">Alunos por mês</h3>
                <MonthBars
                  label="Alunos por mês"
                  formatValue={(value) => formatCount(value, 'aluno', 'alunos')}
                  points={series.map((point) => ({ month: point.month, value: point.activeCount }))}
                />
              </article>
            </div>
            <article className="stats-panel stats-dashboard__arrears" aria-labelledby="stats-arrears">
              <h3 id="stats-arrears" className="stats-subtitle">Atrasos acumulados</h3>
              {arrears.length === 0 ? (
                <p className="stats-empty">Nenhum atraso acumulado</p>
              ) : (
                <div className="stats-table-wrap">
                  <table className="stats-table">
                    <thead>
                      <tr>
                        <th scope="col">Aluno</th>
                        <th scope="col">Mês</th>
                        <th scope="col">Valor</th>
                        <th scope="col">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {arrears.map((row) => (
                        <tr key={row.payment.id}>
                          <td>{row.student.name}</td>
                          <td>{formatMonthLabel(row.payment.competence)}</td>
                          <td>{formatCurrency(row.payment.amount)}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn--primary"
                              disabled={markingId !== null}
                              onClick={() => void markPaid(row.payment)}
                            >
                              {markingId === row.payment.id ? 'Salvando...' : 'Marcar pago'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          </div>
        </section>

        <section className="stats-block" aria-labelledby="stats-month">
          <div className="stats-month-head">
            <h2 id="stats-month" className="stats-section__title">
              Visão do mês
            </h2>
            <div className="month-switch" role="group" aria-label="Mês">
              <button
                type="button"
                className="btn"
                disabled={month <= earliest}
                aria-label="Mês anterior"
                onClick={() => setMonth((current) => shiftMonth(current, -1))}
              >
                Anterior
              </button>
              <span className="month-switch__label">{formatMonthLabel(month)}</span>
              <button
                type="button"
                className="btn"
                disabled={isCurrent}
                aria-label="Mês seguinte"
                onClick={() => setMonth((current) => shiftMonth(current, 1))}
              >
                Próximo
              </button>
            </div>
          </div>
        <section className="stats-block" aria-labelledby="stats-money">
          <h2 id="stats-money" className="stats-section__title">
            Dinheiro
          </h2>
          <div className="stats-grid">
            <article className="stats-card">
              <p className="stats-card__label">Faturamento estimado</p>
              <p className="stats-card__value">
                {stats.revenue === null ? '—' : formatCurrency(stats.revenue)}
              </p>
              <p className="stats-card__hint">
                {stats.revenue === null
                  ? 'Sem registro deste mês'
                  : isCurrent
                    ? 'Soma das mensalidades dos ativos'
                    : 'Mensalidades registradas neste mês'}
              </p>
            </article>
            <article className="stats-card">
              <p className="stats-card__label">Ticket médio</p>
              <p className="stats-card__value">
                {stats.averageTicket === null ? '—' : formatCurrency(stats.averageTicket)}
              </p>
              <p className="stats-card__hint">
                {formatCount(stats.activeCount, 'aluno ativo', 'alunos ativos')}
              </p>
            </article>
            <article className="stats-card">
              <p className="stats-card__label">Receita por aula</p>
              <p className="stats-card__value">
                {stats.revenuePerClass === null ? '—' : formatCurrency(stats.revenuePerClass)}
              </p>
              <p className="stats-card__hint">
                Faturamento do mês dividido pelas aulas do mês
              </p>
            </article>
            <article className="stats-card">
              <p className="stats-card__label">Recebido no mês</p>
              <p className="stats-card__value">
                {stats.received === null ? '—' : formatCurrency(stats.received)}
              </p>
              <p className="stats-card__hint">
                {stats.received === null
                  ? 'Sem registro deste mês'
                  : `de ${formatCurrency(stats.expected)} previstos`}
              </p>
            </article>
            <article className="stats-card">
              <p className="stats-card__label">Em atraso</p>
              <p className="stats-card__value">{formatCurrency(stats.overdueAmount)}</p>
              <p className="stats-card__hint">
                {stats.overdueCount === 0
                  ? 'Nenhum atraso'
                  : formatCount(stats.overdueCount, 'aluno', 'alunos')}
              </p>
            </article>
            {isCurrent && stats.revenue !== null ? (
            <article className="stats-card">
              <p className="stats-card__label">Com reajuste</p>
              <p className="stats-card__value">
                {formatCurrency(stats.revenue + stats.reajusteGap)}
              </p>
              <p className="stats-card__hint">
                {planPrices.length === 0
                  ? 'Defina a tabela vigente em Configurações'
                  : stats.reajusteGap > 0
                    ? `Recuperaria ${formatCurrency(stats.reajusteGap)}`
                    : 'Ninguém abaixo da tabela'}
              </p>
            </article>
            ) : null}
          </div>
        </section>

        <section className="stats-block" aria-labelledby="stats-students">
          <h2 id="stats-students" className="stats-section__title">
            Alunos
          </h2>
          <div className="stats-grid">
            <article className="stats-card">
              <p className="stats-card__label">Ativos</p>
              <p className="stats-card__value">{stats.activeCount}</p>
            </article>
            <article className="stats-card">
              <p className="stats-card__label">Pausados</p>
              <p className="stats-card__value">{stats.pausedCount}</p>
              <p className="stats-card__hint">
                {isCurrent ? 'Fora do faturamento' : 'Pausados hoje que já estavam no mês'}
              </p>
            </article>
            <article className="stats-card">
              <p className="stats-card__label">Novos no mês</p>
              <p className="stats-card__value">{stats.newCount}</p>
            </article>
            <article className="stats-card">
              <p className="stats-card__label">Saídas no mês</p>
              <p className="stats-card__value">{stats.exitCount}</p>
            </article>
            <article className="stats-card">
              <p className="stats-card__label">Retenção do mês</p>
              <p className="stats-card__value">
                {stats.retention
                  ? formatPercent(stats.retention.stayed / stats.retention.base)
                  : '—'}
              </p>
              <p className="stats-card__hint">
                {retentionHint}
                {startHint ? ` · ${startHint}` : ''}
              </p>
            </article>
            <article className="stats-card">
              <p className="stats-card__label">Tempo de casa</p>
              <p className="stats-card__value">{formatMonths(stats.tenureActiveMonths)}</p>
              <p className="stats-card__hint">
                {isCurrent
                  ? 'Média dos ativos com data de início'
                  : 'Média até o fim do mês'}
              </p>
            </article>
            <article className="stats-card">
              <p className="stats-card__label">Até a saída</p>
              <p className="stats-card__value">{formatMonths(stats.tenureLeftMonths)}</p>
              <p className="stats-card__hint">Média de quem encerrou</p>
            </article>
          </div>
        </section>

        {isCurrent ? (
        <section className="stats-block" aria-labelledby="stats-agenda">
          <h2 id="stats-agenda" className="stats-section__title">
            Agenda
          </h2>
          <div className="stats-grid">
            <article className="stats-card">
              <p className="stats-card__label">Ocupação</p>
              <p className="stats-card__value">
                {stats.occupancy === null ? '—' : formatPercent(stats.occupancy)}
              </p>
              <p className="stats-card__hint">
                {stats.slotCount === 0
                  ? 'Nenhuma aula de aluno ativo'
                  : `${stats.sessionCount} aulas em ${stats.slotCount} horários, entre a primeira e a última de cada dia`}
              </p>
            </article>
          </div>
          <div className="stats-columns">
            <div>
              <h3 className="stats-subtitle">Horários de pico</h3>
              {stats.peakTimes.length === 0 ? (
                <p className="stats-empty">Nenhum horário na agenda.</p>
              ) : (
                <ul className="stats-list">
                  {stats.peakTimes.map((item) => (
                    <li key={item.time} className="stats-list__item">
                      <span className="stats-list__title">{item.time}</span>
                      <span className="stats-list__meta">
                        {formatCount(item.count, 'aula na semana', 'aulas na semana')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="stats-subtitle">Horários vagos</h3>
              {stats.emptySlots.length === 0 ? (
                <p className="stats-empty">Nenhum buraco entre a primeira e a última aula.</p>
              ) : (
                <ul className="stats-list">
                  {stats.emptySlots.slice(0, EMPTY_PREVIEW).map((slot) => (
                    <li key={`${slot.day}-${slot.time}`} className="stats-list__item">
                      <span className="stats-list__title">
                        {DAYS.find((day) => day.id === slot.day)?.label} {slot.time}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {stats.emptySlots.length > EMPTY_PREVIEW ? (
                <p className="stats-section__hint">
                  + {stats.emptySlots.length - EMPTY_PREVIEW} horários
                </p>
              ) : null}
            </div>
          </div>
        </section>
        ) : null}

        <section className="stats-block" aria-labelledby="stats-actions">
        <h3 className="stats-subtitle">Pagamentos do mês</h3>
          {stats.received === null ? (
            <p className="stats-empty">Sem registro deste mês.</p>
          ) : paymentRows.length === 0 ? (
            <p className="stats-empty">Nenhum pagamento neste mês.</p>
          ) : (
            <div className="stats-table-wrap">
              <table className="stats-table">
                <thead>
                  <tr>
                    <th scope="col">Aluno</th>
                    <th scope="col">Vencimento</th>
                    <th scope="col">Valor</th>
                    <th scope="col">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRows.map((row) => (
                    <tr key={row.payment.id} className={row.status === 'atrasado' ? 'is-late' : undefined}>
                      <td>{row.student.name}</td>
                      <td>{row.payment.dueOn ? formatIsoDate(row.payment.dueOn) : '—'}</td>
                      <td>{formatCurrency(row.payment.amount)}</td>
                      <td>
                        {row.status === 'aberto' ? null : (
                          <span className={`stats-table__status stats-table__status--${row.status}`}>
                            {STATUS_LABEL[row.status]}
                          </span>
                        )}
                        {row.status === 'pago' ? (
                          <button
                            type="button"
                            className="btn"
                            disabled={markingId !== null}
                            onClick={() => void markUnpaid(row.payment)}
                          >
                            {markingId === row.payment.id ? 'Salvando...' : 'Desfazer'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn--primary"
                            disabled={markingId !== null}
                            onClick={() => void markPaid(row.payment)}
                          >
                            {markingId === row.payment.id ? 'Salvando...' : 'Marcar pago'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          <h2 id="stats-actions" className="stats-section__title">
            Para resolver
          </h2>
          {isCurrent ? (
          <>
          <h3 className="stats-subtitle">Mensalidades defasadas</h3>
          {stats.outdated.length === 0 ? (
            <p className="stats-empty">
              {planPrices.length === 0
                ? 'Defina a tabela vigente em Configurações.'
                : 'Nenhum aluno ativo abaixo da tabela.'}
            </p>
          ) : (
            <ul className="stats-list">
              {stats.outdated.map((item) => (
                <li key={item.student.id} className="stats-list__item">
                  <div>
                    <span className="stats-list__title">{item.student.name}</span>
                    <span className="stats-list__meta">
                      {item.student.weeklyClasses}x/semana · atual{' '}
                      {formatCurrency(item.student.planValue)} · tabela{' '}
                      {formatCurrency(item.tableAmount)} ·{' '}
                      {formatCurrency(item.gap)} abaixo
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
          </>
          ) : null}

      
        </section>
        </section>
        </>
        ) : null}
      </div>
    </div>
  )
}
