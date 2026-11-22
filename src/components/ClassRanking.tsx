import { useEffect, useState } from 'react'
import { fetchClassRanking } from '../api/class'
import type { ClassModality, ClassRanking as ClassRankingData } from '../types'
import { brazilMonth, rankingMonthLabel } from '../utils/dates'

const MODALITIES: { id: ClassModality; label: string }[] = [
  { id: 'hyrox', label: 'Hyrox' },
  { id: 'crossfit', label: 'Crossfit' },
]

interface ClassRankingProps {
  crossfit: boolean
  hyrox: boolean
  modality: ClassModality
  onModality: (modality: ClassModality) => void
}

export function ClassRanking({ crossfit, hyrox, modality, onModality }: ClassRankingProps) {
  const [scope, setScope] = useState<'all' | 'month'>('month')
  const [ranking, setRanking] = useState<ClassRankingData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const both = crossfit && hyrox
  const current = both ? modality : crossfit ? 'crossfit' : 'hyrox'
  const monthLabel = rankingMonthLabel(brazilMonth())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void fetchClassRanking(current, scope)
      .then((next) => {
        if (!cancelled) {
          setRanking(next)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRanking(null)
          setError(err instanceof Error ? err.message : 'Falha ao carregar o ranking')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [current, scope])

  return (
    <section className="class-ranking-panel" aria-label="Comunidade">
      {both ? (
        <div className="segmented class-modality" role="tablist" aria-label="Modalidade">
          {MODALITIES.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={current === item.id}
              className={current === item.id ? 'is-active' : undefined}
              onClick={() => onModality(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      <h2 className="class-ranking-title">Ranking 🏆</h2>
      <div className="class-ranking-scope" role="tablist" aria-label="Período">
        <button
          type="button"
          role="tab"
          aria-selected={scope === 'month'}
          className={scope === 'month' ? 'is-active' : undefined}
          onClick={() => setScope('month')}
        >
          {monthLabel}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={scope === 'all'}
          className={scope === 'all' ? 'is-active' : undefined}
          onClick={() => setScope('all')}
        >
          Geral
        </button>
      </div>
      {error ? <div className="whatsapp-banner whatsapp-banner--error">{error}</div> : null}
      {loading && !ranking ? <p className="page-status">Carregando ranking...</p> : null}
      {ranking && ranking.rows.length === 0 ? (
        <p className="class-empty">Ninguém fez check-in nesse período.</p>
      ) : null}
      {ranking && ranking.rows.length > 0 ? (
        <ol className="class-ranking">
          {ranking.rows.map((row) => (
            <li key={`${row.rank}-${row.name}`} className={row.mine ? 'is-mine' : undefined}>
              <span className="class-ranking__place">{row.rank}</span>
              <span className="class-ranking__name">
                {row.name}
                {row.mine ? <span className="class-ranking__you">você</span> : null}
              </span>
              <span className="class-ranking__score">
                <strong className="class-ranking__count">{row.count}</strong>
                <span className="class-ranking__unit">
                  {row.count === 1 ? 'check-in' : 'check-ins'}
                </span>
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}
