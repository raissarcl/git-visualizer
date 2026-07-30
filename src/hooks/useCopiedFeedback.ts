import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_MS = 1500

/** Flash breve de “copiado” para acionar o tooltip visual. */
export function useCopiedFeedback(ms = DEFAULT_MS) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [])

  const flash = useCallback(() => {
    setCopied(true)
    if (timerRef.current != null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      setCopied(false)
      timerRef.current = null
    }, ms)
  }, [ms])

  return { copied, flash }
}
