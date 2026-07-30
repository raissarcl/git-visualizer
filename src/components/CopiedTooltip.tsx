interface CopiedTooltipProps {
  show: boolean
}

/** Bubble efêmero “Copiado!” — o pai deve ter position relative. */
export function CopiedTooltip({ show }: CopiedTooltipProps) {
  if (!show) return null
  return (
    <span className="copied-tooltip" role="status" aria-live="polite">
      Copiado!
    </span>
  )
}
