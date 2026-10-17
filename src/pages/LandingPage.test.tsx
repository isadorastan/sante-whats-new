import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { LandingPage } from './LandingPage'

it('mostra o preço e as seções, e Entrar abre o login', async () => {
  const user = userEvent.setup()
  const onEnter = vi.fn()
  render(<LandingPage onEnter={onEnter} />)

  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
    'A semana, os alunos e o WhatsApp no mesmo lugar',
  )
  expect(screen.getAllByText('R$ 59,90').length).toBeGreaterThan(0)
  expect(screen.getByRole('heading', { name: 'Funcionalidades' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Preço' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'O que hoje toma tempo' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Como funciona' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Perguntas' })).toBeInTheDocument()

  const contratar = screen.getAllByRole('link', { name: 'Contratar' })
  expect(contratar).toHaveLength(2)
  for (const link of contratar) {
    expect(link).toHaveAttribute('href', '#preco')
  }

  await user.click(contratar[0])
  expect(onEnter).not.toHaveBeenCalled()

  await user.click(screen.getByRole('button', { name: 'Entrar' }))
  expect(onEnter).toHaveBeenCalledOnce()
})
