const MODEL = 'gpt-6-luna'

const SYSTEM = `Você escreve o treino do dia para um quadro branco de CrossFit e Hyrox.
Responda só com o texto do treino, em português, pronto para colar na lousa.
Não explique, não cumprimente e não use markdown.`

export async function draftWorkout(prompt, options = {}) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY
  const fetchImpl = options.fetchImpl ?? fetch
  if (!apiKey) {
    throw assistError(503, 'A IA não está configurada.')
  }
  const response = await fetchImpl('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      reasoning_effort: 'none',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
    }),
  })
  if (response.status === 401) {
    throw assistError(401, 'A chave da IA é inválida.')
  }
  if (response.status === 429) {
    const data = await response.json().catch(() => null)
    const code = data?.error?.code ?? data?.error?.type
    if (code === 'insufficient_quota') {
      throw assistError(429, 'Os créditos da conta acabaram.')
    }
    throw assistError(429, 'Muitas gerações agora. Tente de novo em instantes.')
  }
  if (!response.ok) {
    throw assistError(502, 'Falha ao gerar o treino')
  }
  const data = await response.json()
  const text = String(data?.choices?.[0]?.message?.content ?? '').trim()
  if (!text) throw assistError(502, 'A IA não devolveu um treino')
  return text
}

function assistError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}
