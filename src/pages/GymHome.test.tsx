import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'
import { GymHome } from './GymHome'

it('mostra a logo e o login do aluno', () => {
  render(<GymHome />)

  expect(screen.getByRole('img', { name: 'Santé Centro de Treinamento Físico' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute('href', expect.stringMatching(/aluno$/))
})
