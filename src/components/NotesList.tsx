import { useState } from 'react'
import {
  linkBadgeLabel,
  noteBodyPreview,
  noteListTitle,
  remoteStatusLabel,
  type LocalWorkspaceNoteFilters,
  type NoteLinkFilter,
  type NoteStatus,
  type WorkspaceNote,
} from '../domain/workspaceNote'
import { ConfirmActionModal } from './ConfirmActionModal'
import { CopyableCode } from './CopyableCode'

interface NotesListProps {
  notes: WorkspaceNote[]
  selectedId: string | null
  onSelect: (note: WorkspaceNote) => void
  onCreate: () => void
  onDelete: (id: string) => void
  filters: LocalWorkspaceNoteFilters
  onFiltersChange: (patch: Partial<LocalWorkspaceNoteFilters>) => void
  tagOptions: string[]
  showExcludeGeneral: boolean
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function NotesList({
  notes,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  filters,
  onFiltersChange,
  tagOptions,
  showExcludeGeneral,
}: NotesListProps) {
  const showEmpty = notes.length === 0
  const [pendingDelete, setPendingDelete] = useState<WorkspaceNote | null>(null)

  return (
    <div className="notes-panel">
      <div className="actions-toolbar-filters notes-toolbar-filters">
        <label className="filter-field filter-field-search actions-search">
          <span className="sr-only">Buscar notas</span>
          <input
            type="search"
            placeholder="Buscar notas…"
            value={filters.query}
            onChange={(e) => onFiltersChange({ query: e.target.value })}
          />
        </label>
        <label className="filter-field">
          <span className="sr-only">Status</span>
          <select
            value={filters.status}
            onChange={(e) =>
              onFiltersChange({ status: e.target.value as 'all' | NoteStatus })
            }
          >
            <option value="open">Abertas</option>
            <option value="archived">Arquivadas</option>
            <option value="all">Todas</option>
          </select>
        </label>
        <label className="filter-field">
          <span className="sr-only">Vínculo</span>
          <select
            value={filters.linkType}
            onChange={(e) =>
              onFiltersChange({ linkType: e.target.value as NoteLinkFilter })
            }
          >
            <option value="all">Qualquer vínculo</option>
            <option value="none">Gerais</option>
            <option value="repo">Repo</option>
            <option value="branch">Branch</option>
          </select>
        </label>
        <label className="filter-field">
          <span className="sr-only">Tag</span>
          <select
            value={filters.tag}
            onChange={(e) => onFiltersChange({ tag: e.target.value })}
          >
            <option value="">Qualquer tag</option>
            {tagOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className={`filter-chip${filters.pinnedOnly ? ' is-on' : ''}`}>
          <input
            type="checkbox"
            checked={filters.pinnedOnly}
            onChange={(e) => onFiltersChange({ pinnedOnly: e.target.checked })}
          />
          <span>Pins</span>
        </label>
        <label
          className={`filter-chip${filters.unverifiedOnly ? ' is-on' : ''}`}
        >
          <input
            type="checkbox"
            checked={filters.unverifiedOnly}
            onChange={(e) =>
              onFiltersChange({ unverifiedOnly: e.target.checked })
            }
          />
          <span>Não verificadas</span>
        </label>
        {showExcludeGeneral && (
          <label
            className={`filter-chip${filters.excludeGeneral ? ' is-on' : ''}`}
          >
            <input
              type="checkbox"
              checked={filters.excludeGeneral}
              onChange={(e) =>
                onFiltersChange({ excludeGeneral: e.target.checked })
              }
            />
            <span>Só do escopo</span>
          </label>
        )}
        <button
          type="button"
          className="btn btn-primary notes-create-btn"
          onClick={onCreate}
        >
          Nova nota
        </button>
      </div>

      <div className="pr-list-wrap scrollable">
        <table className="pr-list notes-list">
          <thead>
            <tr>
              <th className="col-state">Tipo</th>
              <th className="col-title">Título</th>
              <th className="col-repo">Repo</th>
              <th className="col-branches">Branch</th>
              <th className="col-note-tags">Tags</th>
              <th className="col-date">Atualizado</th>
              <th className="col-note-actions">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {showEmpty ? (
              <tr className="list-empty-row">
                <td colSpan={7}>
                  Nenhuma nota com os filtros atuais. Crie uma com{' '}
                  <strong>Nova nota</strong>.
                </td>
              </tr>
            ) : (
              notes.map((note) => {
                const selected = selectedId === note.id
                const remote =
                  note.link.type === 'branch' ? note.link.remoteStatus : null
                const listTitle = noteListTitle(note)
                const bodyPreview = noteBodyPreview(note, 100)
                const hasTitle = Boolean(note.title.trim())
                const repo =
                  note.link.type === 'repo' || note.link.type === 'branch'
                    ? note.link.repo
                    : ''
                const branch =
                  note.link.type === 'branch' ? note.link.branch : ''
                return (
                  <tr
                    key={note.id}
                    className={selected ? 'is-selected' : undefined}
                    onClick={() => onSelect(note)}
                  >
                    <td className="col-state">
                      <div className="note-type-cell">
                        <span
                          className={`badge badge-note-link-${note.link.type}`}
                        >
                          {note.link.type === 'none'
                            ? 'geral'
                            : note.link.type === 'repo'
                              ? 'repo'
                              : 'branch'}
                        </span>
                        {remote ? (
                          <span
                            className={`badge badge-note-remote-${remote}`}
                            title={remoteStatusLabel(remote)}
                          >
                            {remoteStatusLabel(remote)}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="col-title">
                      <span className="pr-title-row">
                        {note.pinned && (
                          <span
                            className="note-pin-mark"
                            title="Fixada"
                            aria-label="Fixada"
                          >
                            ◆
                          </span>
                        )}
                        <span className="pr-title" title={listTitle}>
                          {listTitle}
                        </span>
                      </span>
                      {hasTitle && bodyPreview ? (
                        <span className="note-list-preview" title={bodyPreview}>
                          {bodyPreview}
                        </span>
                      ) : null}
                    </td>
                    <td className="col-repo">
                      {repo ? (
                        <CopyableCode
                          value={repo}
                          className="note-link-repo"
                          title={repo}
                        />
                      ) : (
                        <span className="note-cell-empty">—</span>
                      )}
                    </td>
                    <td className="col-branches">
                      {branch.trim() ? (
                        <CopyableCode
                          value={branch}
                          className="note-link-branch"
                          title={branch}
                        />
                      ) : (
                        <span className="note-cell-empty">—</span>
                      )}
                    </td>
                    <td className="col-note-tags">
                      {note.tags.length > 0 ? note.tags.join(', ') : '—'}
                    </td>
                    <td className="col-date">{formatWhen(note.updatedAt)}</td>
                    <td className="col-note-actions">
                      <button
                        type="button"
                        className="btn-note-delete"
                        title="Excluir nota"
                        aria-label={`Excluir nota: ${listTitle}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          setPendingDelete(note)
                        }}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmActionModal
        open={pendingDelete != null}
        title="Excluir nota?"
        subtitle="Esta ação não pode ser desfeita. A nota some só deste navegador."
        lead={null}
        details={
          pendingDelete
            ? [
                { label: 'Título', value: noteListTitle(pendingDelete) },
                {
                  label: 'Vínculo',
                  value: linkBadgeLabel(pendingDelete.link),
                  mono: true,
                },
              ]
            : []
        }
        confirmLabel="Excluir nota"
        cancelLabel="Manter nota"
        tone="danger"
        onConfirm={() => {
          if (!pendingDelete) return
          const id = pendingDelete.id
          setPendingDelete(null)
          onDelete(id)
        }}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
