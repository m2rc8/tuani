import { getToken, clearToken } from './auth'

const BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  })
  if (res.status === 401) {
    clearToken()
    if (typeof window !== 'undefined') {
      window.location.href = '/admin'
      return new Promise<T>(() => {})
    }
    throw new Error('Unauthorized')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}
