import { useEffect, useState } from 'react'
import { fetchClassStats } from '../api/class'
import type { ClassStats as ClassStatsData } from '../types'
import { addIsoDays, weekStartMonday } from '../utils/classDates'
import { formatIsoDate, rankingMonthLabel, shiftMonth } from '../utils/dates'

interface ClassStatsProps {
  crossfit: boolean
  hyrox: boolean
}

const WEEKDAY_MARKS = new Set([0, 2, 4])
const WEEKDAY_LABELS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom']

function yearWeeks(year: string): string[][] {
  const start = weekStartMonday(`${year}-01-01`)
  const end = addIsoDays(weekStartMonday(`${year}-12-31`), 6)
  const weeks: string[][] = []
  for (let cursor = start; cursor <= end; cursor = addIsoDays(cursor, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, index) => addIsoDays(cursor, index)))
  }
  return weeks
}

function monthWeeks(month: string): (string | null)[][] {
  const start = `${month}-01`
  const next = `${shiftMonth(month, 1)}-01`
  const weeks: (string | null)[][] = []
  for (let cursor = weekStartMonday(start); cursor < next; cursor = addIsoDays(cursor, 7)) {
    weeks.push(
      Array.from({ length: 7 }, (_, index) => {
        const date = addIsoDays(cursor, index)
        return date >= start && date < next ? date : null
      }),
    )
  }
  return weeks
}

function monthLabel(week: string[], today: string, firstColumn: boolean): string {
  const opened = week.find((date) => date <= today && date.endsWith('-01'))
  const marked = opened ?? (firstColumn ? (week.find((date) => date <= today) ?? week[0]) : '')
  if (!marked) return ''
  return rankingMonthLabel(marked.slice(0, 7)).slice(0, 3)
}

function cellTitle(date: string, count: number): string {
  const unit = count === 1 ? 'check-in' : 'check-ins'
  return `${formatIsoDate(date)} · ${count} ${unit}`
}

function periodName(view: 'month' | 'year', cursor: string): string {
  if (view === 'year') return cursor
  return `${rankingMonthLabel(cursor)} ${cursor.slice(0, 4)}`
}

export function ClassStats({ crossfit, hyrox }: ClassStatsProps) {
  const [stats, setStats] = useState<ClassStatsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const both = crossfit && hyrox

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchClassStats()
      .then((next) => {
        if (!cancelled) {
          setStats(next)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setStats(null)
          setError(err instanceof Error ? err.message : 'Falha ao carregar as estatísticas')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const counts = new Map(stats?.days.map((day) => [day.date, day.count]) ?? [])
  const monthValue = stats?.today.slice(0, 7) ?? ''
  const yearValue = stats?.today.slice(0, 4) ?? ''

  return (
    <section className="class-stats" aria-label="Estatísticas">
      {error ? <div className="whatsapp-banner whatsapp-banner--error">{error}</div> : null}
      {loading && !stats ? <p className="page-status">Carregando estatísticas...</p> : null}
      {stats ? (
        <>
          <div className="class-stats-counts">
            <div className="class-stats-count">
              <strong>{stats.total}</strong>
              <span>Total</span>
            </div>
            <div className="class-stats-count">
              <strong>{stats.month}</strong>
              <span>Neste mês</span>
            </div>
            <div className="class-stats-count">
              <strong>{stats.week}</strong>
              <span>Nesta semana</span>
            </div>
          </div>
          {both ? (
            <div className="class-stats-split">
              <div className="class-stats-count">
                <strong>{stats.crossfit}</strong>
                <span>Crossfit</span>
              </div>
              <div className="class-stats-count">
                <strong>{stats.hyrox}</strong>
                <span>Hyrox</span>
              </div>
            </div>
          ) : null}
          <hr className="class-stats-rule" />
          <h2 className="class-ranking-title">Seus check-ins 💪</h2>
          <div className="class-stats-heat">
            <div className="class-stats-block">
              <h3 className="class-stats-title">{periodName('month', monthValue)}</h3>
              <div className="class-stats-calendar" aria-label={`Presenças de ${periodName('month', monthValue)}`}>
                {WEEKDAY_LABELS.map((label) => (
                  <span key={label} className="class-stats-calendar-label">
                    {label}
                  </span>
                ))}
                {monthWeeks(monthValue).flat().map((date, index) => {
                  if (!date) return <span key={`pad-${index}`} className="class-stats-calendar-pad" />
                  const future = date > stats.today
                  const count = counts.get(date) ?? 0
                  const level = count >= 2 ? 'is-2' : count === 1 ? 'is-1' : ''
                  return (
                    <span
                      key={date}
                      className={`class-stats-cell${future ? ' is-ahead' : ''} ${future ? '' : level}`.trim()}
                      title={future ? undefined : cellTitle(date, count)}
                    />
                  )
                })}
              </div>
            </div>
            <div className="class-stats-block">
              <h3 className="class-stats-title">{yearValue}</h3>
              <div className="class-stats-plot" aria-label={`Presenças de ${yearValue}`}>
                <div className="class-stats-days" aria-hidden="true">
                  <span />
                  {WEEKDAY_LABELS.map((label, index) => (
                    <span key={label}>{WEEKDAY_MARKS.has(index) ? label : ''}</span>
                  ))}
                </div>
                <div className="class-stats-weeks">
                  {yearWeeks(yearValue).map((week, index) => (
                    <div className="class-stats-week" key={week[0]}>
                      <span className="class-stats-month">
                        {monthLabel(week, stats.today, index === 0)}
                      </span>
                      {week.map((date) => {
                        const outside = !date.startsWith(yearValue)
                        const future = !outside && date > stats.today
                        const count = counts.get(date) ?? 0
                        const level = count >= 2 ? 'is-2' : count === 1 ? 'is-1' : ''
                        return (
                          <span
                            key={date}
                            className={`class-stats-cell${outside ? ' is-future' : future ? ' is-ahead' : ''} ${outside || future ? '' : level}`.trim()}
                            title={outside || future ? undefined : cellTitle(date, count)}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="class-stats-legend">
              <span>Menos</span>
              <span className="class-stats-cell" />
              <span className="class-stats-cell is-1" />
              <span className="class-stats-cell is-2" />
              <span>Mais</span>
            </p>
          </div>
        </>
      ) : null}
    </section>
  )
}
