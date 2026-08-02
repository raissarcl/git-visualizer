import { createPortal } from 'react-dom'

export interface ConfirmDetailRow {
  label: string
  value: string
  mono?: boolean
}

interface ConfirmActionModalProps {
  open: boolean
  title: string
  subtitle?: string
  details?: ConfirmDetailRow[]
  /** Texto acima dos detalhes; `null` omite. */
  lead?: string | null
  confirmLabel?: string
  cancelLabel?: string
  /** Ação terciária (ex.: fechar sem salvar). */
  secondaryLabel?: string
  onSecondary?: () => void
  /** Visual do botão confirmar (excluir = danger). */
  tone?: 'default' | 'danger'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmActionModal({
  open,
  title,
  subtitle,
  details = [],
  lead = 'Revise os dados antes de continuar:',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Voltar',
  secondaryLabel,
  onSecondary,
  tone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmActionModalProps) {
  if (!open) return null

  const modal = (
    <div
      className="org-overlay confirm-overlay"
      role="presentation"
      onClick={onCancel}
    >
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
          {lead != null && lead !== '' ? (
            <p className="confirm-lead">{lead}</p>
          ) : null}
          {details.length > 0 ? (
            <dl className="confirm-details">
              {details.map((row) => (
                <div key={row.label} className="confirm-details-row">
                  <dt>{row.label}</dt>
                  <dd className={row.mono ? 'is-mono' : undefined}>
                    {row.value || '—'}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <footer className="org-footer confirm-footer">
          <button
            type="button"
            className="btn"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel}
          </button>
          {secondaryLabel && onSecondary ? (
            <button
              type="button"
              className="btn"
              onClick={onSecondary}
              disabled={busy}
            >
              {secondaryLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn${tone === 'danger' ? ' btn-confirm-danger' : ' btn-primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? 'Executando…' : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}
