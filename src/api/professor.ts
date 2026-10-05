import { apiFetch } from './http'

export type ProfessorProfile = {
  name: string
  phone: string
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as
    | T
    | { error?: string }
    | null
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data && data.error
        ? String(data.error)
        : `Erro HTTP ${res.status}`
    throw new Error(message)
  }
  return data as T
}

export async function fetchProfessor(): Promise<ProfessorProfile> {
  const res = await apiFetch('/api/professor')
  return parseJson<ProfessorProfile>(res)
}

export async function saveProfessor(
  input: ProfessorProfile,
): Promise<ProfessorProfile> {
  const res = await apiFetch('/api/professor', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  return parseJson<ProfessorProfile>(res)
}
