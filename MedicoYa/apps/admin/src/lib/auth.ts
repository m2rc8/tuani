const TOKEN_KEY = 'medicoya_admin_token'
const ROLE_KEY  = 'medicoya_admin_role'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function getRole(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ROLE_KEY)
}

export function setRole(role: 'admin' | 'coordinator'): void {
  localStorage.setItem(ROLE_KEY, role)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ROLE_KEY)
}
