import { expect, it } from 'vitest'
import { draftWorkout } from './workoutAssist.js'

it('manda só o pedido ao ChatGPT e devolve o treino', async () => {
  let sent
  const text = await draftWorkout('monte um aquecimento com snatch', {
    apiKey: 'test-key',
    fetchImpl: async (url, init) => {
      sent = JSON.parse(init.body)
      expect(url).toBe('https://api.openai.com/v1/chat/completions')
      expect(init.headers.Authorization).toBe('Bearer test-key')
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: 'Aquecimento\n3 snatch' } }],
        }),
      }
    },
  })

  expect(text).toBe('Aquecimento\n3 snatch')
  expect(sent.model).toBe('gpt-6-luna')
  expect(sent.messages[1].content).toBe('monte um aquecimento com snatch')
  expect(JSON.stringify(sent.messages[1])).not.toContain('treino atual')
})

it('avisa quando a IA não está configurada', async () => {
  await expect(draftWorkout('um treino', { apiKey: '' })).rejects.toMatchObject({
    message: 'A IA não está configurada.',
    status: 503,
  })
})

it('avisa quando os créditos da conta acabam', async () => {
  await expect(
    draftWorkout('um treino', {
      apiKey: 'test-key',
      fetchImpl: async () => ({
        ok: false,
        status: 429,
        json: async () => ({ error: { code: 'insufficient_quota' } }),
      }),
    }),
  ).rejects.toThrow('Os créditos da conta acabaram')
})
