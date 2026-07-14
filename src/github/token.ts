/**
 * Persistência do Personal Access Token no browser.
 * Único storage vivendo em `github/` — o PAT não entra em backup/export.
 */

const TOKEN_KEY = 'gh_pat'

export function getStoredToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}

export function saveToken(token: string): void {
  const trimmed = token.trim()
  if (trimmed) {
    localStorage.setItem(TOKEN_KEY, trimmed)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}
