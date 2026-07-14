/**
 * Preferências de UI (`localStorage`).
 */

export const SIDEBAR_COLLAPSED_KEY = 'pr-network-sidebar-collapsed'

export function loadSidebarCollapsed(): boolean {
  return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1'
}

export function saveSidebarCollapsed(collapsed: boolean): void {
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0')
}
