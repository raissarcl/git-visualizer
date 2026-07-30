import { copyText } from '../lib/clipboard'
import { useCopiedFeedback } from '../hooks/useCopiedFeedback'
import { CopiedTooltip } from './CopiedTooltip'

interface CopyMarkdownButtonProps {
  value: string
  /** Label do botão (default: Copiar markdown). */
  label?: string
  title?: string
  className?: string
}

/** Botão que copia markdown e mostra tooltip “Copiado!” sem trocar o label. */
export function CopyMarkdownButton({
  value,
  label = 'Copiar markdown',
  title = 'Copiar em markdown',
  className = 'btn-copy',
}: CopyMarkdownButtonProps) {
  const { copied, flash } = useCopiedFeedback()
  const trimmed = value.trim()
  if (!trimmed) return null

  const copy = async () => {
    if (!(await copyText(trimmed))) return
    flash()
  }

  return (
    <span className="copy-feedback-wrap">
      <button
        type="button"
        className={className}
        onClick={() => {
          void copy()
        }}
        title={title}
        aria-label={title}
      >
        {label}
      </button>
      <CopiedTooltip show={copied} />
    </span>
  )
}
