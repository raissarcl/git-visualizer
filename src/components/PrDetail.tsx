import { useEffect, useState } from 'react'
import { prKey } from '../domain/prKey'
import type { PullRequest } from '../domain/pullRequest'
import { hasNote } from '../storage/notes'
import { SafeMarkdown } from './SafeMarkdown'

interface PrDetailProps {
  pr: PullRequest | null
  note: string
  pinned: boolean
  onNoteChange: (key: string, text: string) => void
  onTogglePin: (key: string) => void
  onClose: () => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function CopyBranch({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  return (
    <div className="copy-branch">
      <span className="copy-branch-label">{label}</span>
      <code title={value}>{value}</code>
      <button type="button" className="btn-copy" onClick={() => { copy() }} title="Copiar">
        {copied ? 'Copiado!' : 'Copiar'}
      </button>
    </div>
  )
}

export function PrDetail({
  pr,
  note,
  pinned,
  onNoteChange,
  onTogglePin,
  onClose,
}: PrDetailProps) {
  const [draft, setDraft] = useState(note)
  const [notesMode, setNotesMode] = useState<'edit' | 'preview'>('edit')

  useEffect(() => {
    setDraft(note)
  }, [pr?.id, note])

  useEffect(() => {
    setNotesMode('edit')
  }, [pr?.id])

  if (!pr) return null

  const key = prKey(pr.repo, pr.number)
  const noteFilled = hasNote({ [key]: draft }, key)
  const conflicting = pr.mergeable === 'CONFLICTING'

  const persist = (text: string) => {
    onNoteChange(key, text)
  }

  return (
    <aside className="detail-drawer scrollable" aria-label="Detalhe do PR">
      <div className="detail-toolbar">
        <button
          type="button"
          className={`btn-pin${pinned ? ' is-pinned' : ''}`}
          onClick={() => onTogglePin(key)}
          title={pinned ? 'Desafixar PR' : 'Fixar PR'}
          aria-pressed={pinned}
        >
          {pinned ? 'Fixado' : 'Fixar'}
        </button>
        <button type="button" className="detail-close" onClick={onClose} aria-label="Fechar">
          ×
        </button>
      </div>
      <p className="detail-eyebrow">
        {pr.repo} · #{pr.number}
      </p>
      <h2>{pr.title}</h2>

      {conflicting && (
        <div className="detail-conflict-banner" role="status">
          Este PR tem conflito de merge
        </div>
      )}

      <div className="detail-branches-block">
        <CopyBranch label="Head" value={pr.headRefName} />
        <span className="detail-branch-arrow" aria-hidden="true">
          →
        </span>
        <CopyBranch label="Base" value={pr.baseRefName} />
      </div>

      <dl className="detail-meta">
        <div>
          <dt>Estado</dt>
          <dd>
            <span className={`badge badge-${pr.state.toLowerCase()}`}>{pr.state}</span>
            {conflicting && <span className="badge badge-conflict">conflito</span>}
          </dd>
        </div>
        <div>
          <dt>Autor</dt>
          <dd>{pr.authorLogin}</dd>
        </div>
        <div>
          <dt>Criado</dt>
          <dd>{formatDate(pr.createdAt)}</dd>
        </div>
        <div>
          <dt>Atualizado</dt>
          <dd>{formatDate(pr.updatedAt)}</dd>
        </div>
      </dl>

      <div className="detail-body">
        <h3>Descrição</h3>
        {pr.body ? (
          <div className="detail-body-md scrollable">
            <SafeMarkdown>{pr.body}</SafeMarkdown>
          </div>
        ) : (
          <p className="detail-body-empty">Sem descrição.</p>
        )}
      </div>

      <div className="detail-notes">
        <div className="detail-notes-heading">
          <h3>Notas</h3>
          {noteFilled && <span className="note-badge" title="Tem nota local">nota</span>}
          <div className="notes-mode-tabs" role="tablist" aria-label="Modo das notas">
            <button
              type="button"
              role="tab"
              className={notesMode === 'edit' ? 'is-active' : undefined}
              aria-selected={notesMode === 'edit'}
              onClick={() => setNotesMode('edit')}
            >
              Editar
            </button>
            <button
              type="button"
              role="tab"
              className={notesMode === 'preview' ? 'is-active' : undefined}
              aria-selected={notesMode === 'preview'}
              onClick={() => setNotesMode('preview')}
            >
              Preview
            </button>
          </div>
        </div>
        <p className="detail-notes-hint">Salvas só neste navegador</p>
        {notesMode === 'edit' ? (
          <textarea
            className="detail-notes-input"
            value={draft}
            onChange={(e) => {
              const value = e.target.value
              setDraft(value)
              persist(value)
            }}
            onBlur={() => persist(draft)}
            placeholder="Ex.: script de banco a rodar antes do deploy…"
            rows={5}
            spellCheck
          />
        ) : draft.trim() ? (
          <div className="detail-body-md detail-notes-preview scrollable">
            <SafeMarkdown>{draft}</SafeMarkdown>
          </div>
        ) : (
          <p className="detail-body-empty">Nada para pré-visualizar.</p>
        )}
      </div>

      <div className="detail-actions">
        <a
          className="btn btn-primary detail-link"
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Abrir no GitHub
        </a>
      </div>
    </aside>
  )
}
