import { expect, it } from 'vitest'
import {
  formatBrazilPhone,
  normalizePhone,
  newStudentPassword,
  normalizeUsername,
  resolveLoginEmail,
  studentAccessUrl,
  welcomeMessage,
} from './studentAccount.js'

it('aceita usuário curto e recusa espaço', () => {
  expect(normalizeUsername(' Ana.Silva ')).toBe('ana.silva')
  expect(normalizeUsername('an')).toBe('')
  expect(normalizeUsername('ana silva')).toBe('')
})

it('entra com o usuário e mantém o e-mail do professor', () => {
  expect(resolveLoginEmail('Ana.Silva')).toBe('ana.silva@alunos.sante.invalid')
  expect(resolveLoginEmail('Prof@Sante.com')).toBe('prof@sante.com')
  expect(resolveLoginEmail('a')).toBe('')
})

it('gera uma senha nova de 8 caracteres', () => {
  const password = newStudentPassword()
  expect(password).toMatch(/^[a-z2-9]{8}$/)
})

it('usa o domínio do check-in no link de acesso', () => {
  delete process.env.STUDENT_APP_URL
  expect(studentAccessUrl()).toBe('https://ctfsante.com.br/aluno')
})

it('monta a mensagem com link, usuário e senha', () => {
  const text = welcomeMessage({
    name: 'Ana',
    username: 'ana',
    password: 'senha123',
    url: 'https://ctfsante.com.br/aluno',
  })
  expect(text).toContain('https://ctfsante.com.br/aluno?email=ana&senha=senha123')
  expect(text).toContain('Usuário: ana')
  expect(text).toContain('Senha: senha123')
})

it('guarda o celular com DDI e mostra com máscara', () => {
  expect(normalizePhone('(11) 98888-7766')).toBe('5511988887766')
  expect(normalizePhone('123')).toBe('')
  expect(formatBrazilPhone('5511988887766')).toBe('(11) 98888-7766')
})
