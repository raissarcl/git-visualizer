import type { KeyboardEvent, MouseEvent } from 'react'
import { copyText } from '../lib/clipboard'
import { useCopiedFeedback } from '../hooks/useCopiedFeedback'
import { CopiedTooltip } from './CopiedTooltip'

interface CopyableCodeProps {
  value: string
  className?: string
  title?: string
}

/** Texto mono clicável: copia ao clicar e mostra tooltip “Copiado!”. */
export function CopyableCode({ value, className, title }: CopyableCodeProps) {
  const { copied, flash } = useCopiedFeedback()
  const trimmed = value.trim()
  if (!trimmed) return null

  const copy = async (e: MouseEvent | KeyboardEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!(await copyText(trimmed))) return
    flash()
  }

  const hint = title ?? `Clique para copiar ${trimmed}`

  return (
    <span className="copy-feedback-wrap">
      <button
        type="button"
        className={`copyable-code${copied ? ' is-copied' : ''}${className ? ` ${className}` : ''}`}
        onClick={copy}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') void copy(e)
        }}
        title={hint}
        aria-label={hint}
      >
        {trimmed}
      </button>
      <CopiedTooltip show={copied} />
    </span>
  )
}
