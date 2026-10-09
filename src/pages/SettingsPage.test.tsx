import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { fetchPlanPrices, savePlanPrices } from '../api/data'
import { fetchProfessor, saveProfessor } from '../api/professor'
import { SettingsPage } from './SettingsPage'

vi.mock('../api/data', () => ({
  fetchPlanPrices: vi.fn(),
  savePlanPrices: vi.fn(),
}))

vi.mock('../api/professor', () => ({
  fetchProfessor: vi.fn(),
  saveProfessor: vi.fn(),
}))

beforeEach(() => {
  vi.mocked(fetchPlanPrices).mockResolvedValue([{ weeklyClasses: 2, amount: 180 }])
  vi.mocked(savePlanPrices).mockResolvedValue([{ weeklyClasses: 2, amount: 200 }])
  vi.mocked(fetchProfessor).mockResolvedValue({ name: 'Jean', phone: '51999999999' })
  vi.mocked(saveProfessor).mockResolvedValue({ name: 'Jean Silva', phone: '51988888888' })
})

it('edita e salva a tabela vigente', async () => {
  const user = userEvent.setup()
  render(<SettingsPage />)

  const input = await screen.findByRole('textbox', { name: 'Preço 2x na semana' })
  expect(input).toHaveValue('180,00')

  await user.clear(input)
  await user.type(input, '200,00')
  await user.click(screen.getByRole('button', { name: 'Salvar tabela' }))

  await waitFor(() => {
    expect(savePlanPrices).toHaveBeenCalledWith([{ weeklyClasses: 2, amount: 200 }])
  })
  expect(screen.getByText('Tabela salva')).toBeInTheDocument()

  expect(screen.getByRole('textbox', { name: 'Nome' })).toHaveValue('Jean')
  await user.clear(screen.getByRole('textbox', { name: 'Nome' }))
  await user.type(screen.getByRole('textbox', { name: 'Nome' }), 'Jean Silva')
  await user.click(screen.getByRole('button', { name: 'Salvar' }))

  await waitFor(() => {
    expect(saveProfessor).toHaveBeenCalledWith({
      name: 'Jean Silva',
      phone: '51999999999',
    })
  })
  expect(screen.getByText('Dados salvos')).toBeInTheDocument()
})
