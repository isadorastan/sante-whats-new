import { useEffect, useState, type FormEvent } from 'react'
import { fetchPlanPrices, savePlanPrices } from '../api/data'
import { fetchProfessor, saveProfessor } from '../api/professor'
import type { PlanPrice } from '../types'
import { parseCurrencyInput } from '../utils/format'

const WORKING_DAYS = 5;

function pricesToForm(prices: PlanPrice[]): string[] {
  const form = Array.from({ length: WORKING_DAYS }, () => '')
  for (const price of prices) {
    if (price.weeklyClasses < 1 || price.weeklyClasses > WORKING_DAYS) continue
    form[price.weeklyClasses - 1] = price.amount.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }
  return form
}

export function SettingsPage() {
  const [priceForm, setPriceForm] = useState<string[]>(() => Array.from({ length: WORKING_DAYS }, () => ''))
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingTable, setSavingTable] = useState(false)
  const [savingProfessor, setSavingProfessor] = useState(false)
  const [tableError, setTableError] = useState<string | null>(null)
  const [professorError, setProfessorError] = useState<string | null>(null)
  const [tableSaved, setTableSaved] = useState(false)
  const [professorSaved, setProfessorSaved] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.allSettled([fetchPlanPrices(), fetchProfessor()]).then((results) => {
      if (cancelled) return
      const [prices, profile] = results
      if (prices.status === 'fulfilled') {
        setPriceForm(pricesToForm(prices.value))
        setTableError(null)
      } else {
        const reason = prices.reason
        setTableError(reason instanceof Error ? reason.message : 'Falha ao carregar a tabela')
      }
      if (profile.status === 'fulfilled') {
        setName(profile.value.name)
        setPhone(profile.value.phone)
        setProfessorError(null)
      } else {
        const reason = profile.reason
        setProfessorError(
          reason instanceof Error ? reason.message : 'Não foi possível carregar os dados do professor',
        )
      }
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function saveTable() {
    if (savingTable) return
    const prices: PlanPrice[] = []
    for (let index = 0; index < priceForm.length; index += 1) {
      const raw = priceForm[index].trim()
      if (!raw) continue
      const amount = parseCurrencyInput(raw)
      if (amount === null) {
        setTableSaved(false)
        setTableError(`Valor inválido na frequência ${index + 1}x`)
        return
      }
      prices.push({ weeklyClasses: index + 1, amount })
    }

    setSavingTable(true)
    setTableSaved(false)
    setTableError(null)
    try {
      const next = await savePlanPrices(prices)
      setPriceForm(pricesToForm(next))
      setTableSaved(true)
    } catch (err) {
      setTableError(err instanceof Error ? err.message : 'Falha ao salvar a tabela')
    } finally {
      setSavingTable(false)
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault()
    if (savingProfessor) return
    setSavingProfessor(true)
    setProfessorSaved(false)
    setProfessorError(null)
    try {
      const saved = await saveProfessor({
        name: name.trim(),
        phone: phone.trim(),
      })
      setName(saved.name)
      setPhone(saved.phone)
      setProfessorSaved(true)
    } catch (err) {
      setProfessorError(err instanceof Error ? err.message : 'Não foi possível salvar')
    } finally {
      setSavingProfessor(false)
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1 className="page-header__title">Configurações</h1>
          <p className="page-header__subtitle">Tabela de preços e dados do professor</p>
        </div>
      </header>

      <div className="page-body stats-page">
        {tableError ? (
          <div className="whatsapp-banner whatsapp-banner--error">{tableError}</div>
        ) : null}
        {professorError ? (
          <div className="whatsapp-banner whatsapp-banner--error">{professorError}</div>
        ) : null}
        {loading ? <p className="page-status">Carregando configurações...</p> : null}

        {!loading ? (
          <>
          <section className="stats-panel">
            <div className="stats-panel__head">
              <h2 className="stats-section__title">Dados do professor</h2>
              <p className="stats-section__hint">
                O nome entra no aviso dos alunos. O telefone recebe, às 21h, o resumo da agenda do dia seguinte.
              </p>
            </div>
            <form onSubmit={(event) => void saveProfile(event)}>
              <div className="students-form__grid">
                <label className="students-field">
                  <span>Nome</span>
                  <input
                    className="students-form__input"
                    value={name}
                    onChange={(event) => {
                      setProfessorSaved(false)
                      setName(event.target.value)
                    }}
                    autoComplete="name"
                  />
                </label>
                <label className="students-field">
                  <span>WhatsApp</span>
                  <input
                    className="students-form__input"
                    value={phone}
                    onChange={(event) => {
                      setProfessorSaved(false)
                      setPhone(event.target.value)
                    }}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="DDD + número"
                  />
                </label>
              </div>
              <div className="students-form__actions">
                {professorSaved ? <span className="stats-section__hint">Dados salvos</span> : null}
                <button type="submit" className="btn btn--primary" disabled={savingProfessor}>
                  {savingProfessor ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </section>

          <section className="stats-panel">
            <div className="stats-panel__head">
              <h2 className="stats-section__title">Tabela vigente</h2>
              <p className="stats-section__hint">
                Preço de referência por vezes na semana. Quem está abaixo entra em mensalidade defasada.
              </p>
            </div>
            <div className="stats-prices">
              {priceForm.map((value, index) => (
                <label key={index} className="students-field">
                  <span>{index + 1}x</span>
                  <input
                    className="students-form__input"
                    type="text"
                    inputMode="decimal"
                    value={value}
                    placeholder="0,00"
                    aria-label={`Preço ${index + 1}x na semana`}
                    onChange={(event) => {
                      const next = event.target.value
                      setTableSaved(false)
                      setPriceForm((prev) => prev.map((item, i) => (i === index ? next : item)))
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="students-form__actions">
              {tableSaved ? <span className="stats-section__hint">Tabela salva</span> : null}
              <button
                type="button"
                className="btn btn--primary"
                disabled={savingTable}
                onClick={() => void saveTable()}
              >
                Salvar tabela
              </button>
            </div>
          </section>
          </>
        ) : null}
      </div>
    </div>
  )
}
