export interface ConfirmDetailRow {
  label: string
  value: string
  mono?: boolean
}

interface ConfirmActionModalProps {
  open: boolean
  title: string
  subtitle?: string
  details: ConfirmDetailRow[]
  confirmLabel?: string
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmActionModal({
  open,
  title,
  subtitle,
  details,
  confirmLabel = 'Confirmar',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmActionModalProps) {
  if (!open) return null

  return (
    <div className="org-overlay confirm-overlay" role="presentation" onClick={onCancel}>
      <div
        className="org-modal confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-action-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="org-header">
          <div>
            <h2 id="confirm-action-title">{title}</h2>
            {subtitle ? <p className="org-subtitle">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            className="detail-close"
            onClick={onCancel}
            aria-label="Fechar"
            disabled={busy}
          >
            ×
          </button>
        </header>

        <div className="confirm-body">
          <p className="confirm-lead">Revise os dados antes de continuar:</p>
          <dl className="confirm-details">
            {details.map((row) => (
              <div key={row.label} className="confirm-details-row">
                <dt>{row.label}</dt>
                <dd className={row.mono ? 'is-mono' : undefined}>{row.value || '—'}</dd>
              </div>
            ))}
          </dl>
        </div>

        <footer className="org-footer">
          <button type="button" className="btn" onClick={onCancel} disabled={busy}>
            Voltar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Executando…' : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  )
}
