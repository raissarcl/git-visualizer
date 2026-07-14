/**
 * Tema light/dark persistido em `localStorage`.
 */

import { useCallback, useState } from 'react'
import {
  applyTheme,
  loadTheme,
  saveTheme,
  type Theme,
} from '../storage/preferences'

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => {
    const initial = loadTheme()
    applyTheme(initial)
    return initial
  })

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next)
    saveTheme(next)
    setThemeState(next)
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }, [setTheme, theme])

  return { theme, setTheme, toggleTheme }
}
