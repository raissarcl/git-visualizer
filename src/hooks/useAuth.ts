/**
 * Autenticação local: PAT no localStorage.
 * Após salvar, o valor deixa de ficar no input (só em memória + storage).
 */

import { useCallback, useState } from 'react'
import { getStoredToken, saveToken } from '../github'

export function useAuth() {
  const [token, setToken] = useState(() => getStoredToken())
  const [tokenInput, setTokenInput] = useState('')

  const save = useCallback(() => {
    saveToken(tokenInput)

    const next = tokenInput.trim()
    setToken(next)
    setTokenInput('')

    return next
  }, [tokenInput])

  const clearToken = useCallback(() => {
    saveToken('')
    setToken('')
    setTokenInput('')
  }, [])

  return {
    tokenInput,
    setTokenInput,
    token,
    setToken,
    save,
    clearToken,
    hasToken: Boolean(token),
  }
}
