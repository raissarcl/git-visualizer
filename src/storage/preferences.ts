/**
 * Preferências de UI (`localStorage`).
 */

export const SIDEBAR_COLLAPSED_KEY = 'pr-network-sidebar-collapsed'
export const THEME_KEY = 'pr-network-theme'

export type Theme = 'dark' | 'light'

export function loadSidebarCollapsed(): boolean {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
}

export function loadTheme(): Theme {
  const raw = localStorage.getItem(THEME_KEY)
  return raw === 'light' ? 'light' : 'dark'
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(THEME_KEY, theme)
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
}
