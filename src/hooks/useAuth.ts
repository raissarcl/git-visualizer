/**
 * Autenticação local: PAT no localStorage.
 * Após salvar, o valor deixa de ficar no input (só em memória + storage).
 */

import { useCallback, useState } from 'react'
import { getStoredToken, saveToken } from '../github'

export function useAuth() {
  const [token, setToken] = useState(() => getStoredToken())
  const [tokenInput, setTokenInput] = useState('')
  const [editingToken, setEditingToken] = useState(() => !getStoredToken())

  const save = useCallback(() => {
    saveToken(tokenInput)

    const next = tokenInput.trim()
    setToken(next)
    setTokenInput('')

    if (next) setEditingToken(false)
    else setEditingToken(true)

    return next
  }, [tokenInput])

  const startEditToken = useCallback(() => {
    setEditingToken(true)
    setTokenInput('')
  }, [])

  const cancelEditToken = useCallback(() => {
    setTokenInput('')
    if (getStoredToken()) setEditingToken(false)
  }, [])

  return {
    tokenInput,
    setTokenInput,
    token,
    setToken,
    save,
    hasToken: Boolean(token),
    editingToken,
    startEditToken,
    cancelEditToken,
  }
}
