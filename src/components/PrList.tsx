import type { PinSet, PrNotesMap } from '../domain/filters'
import { prKey } from '../domain/prKey'
import type { PullRequest } from '../domain/pullRequest'
import { hasNote } from '../storage/notes'
import { isPinned } from '../storage/pins'

interface PrListProps {
  prs: PullRequest[]
  selectedId: string | null
  notes: PrNotesMap
  pins: PinSet
  onSelect: (pr: PullRequest) => void
  hasMore: boolean
  loading?: boolean
  loadingMore: boolean
  onLoadMore: () => void
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function PrList({
  prs,
  selectedId,
  notes,
  pins,
  onSelect,
  hasMore,
  loading = false,
  loadingMore,
  onLoadMore,
}: PrListProps) {
  const showEmpty = !loading && prs.length === 0

  return (
    <div className={`pr-list-wrap scrollable${loading ? ' is-loading' : ''}`} aria-busy={loading}>
      <table className="pr-list">
        <thead>
          <tr>
            <th className="col-num">#</th>
            <th className="col-title">Título</th>
            <th className="col-repo">Repositório</th>
            <th className="col-branches">Branches</th>
            <th className="col-state">Estado</th>
            <th className="col-date">Atualizado</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr className="list-loading-row">
              <td colSpan={6}>
                <span className="list-loading-label">Carregando PRs…</span>
              </td>
            </tr>
          ) : showEmpty ? (
            <tr className="list-empty-row">
              <td colSpan={6}>Nenhum PR para mostrar com os filtros atuais.</td>
            </tr>
          ) : (
            prs.map((pr) => {
              const key = prKey(pr.repo, pr.number)
              const selected = selectedId === key
              const noted = hasNote(notes, key)
              const pinned = isPinned(pins, key)
              const conflicting = pr.mergeable === 'CONFLICTING'
              return (
                <tr
                  key={pr.id}
                  className={selected ? 'is-selected' : undefined}
                  onClick={() => onSelect(pr)}
                >
                  <td className="col-num">
                    <span className="pr-num">#{pr.number}</span>
                  </td>
                  <td className="col-title">
                    <span className="pr-title-row">
                      {pinned && (
                        <span className="pin-mark" title="Fixado" aria-label="Fixado">
                          ♥
                        </span>
                      )}
                      {noted && (
                        <span
                          className="note-dot"
                          title="Tem nota local"
                          aria-label="Tem nota local"
                        />
                      )}
                      <span className="pr-title" title={pr.title}>
                        {pr.title}
                      </span>
                    </span>
                    <span className="pr-author">{pr.authorLogin}</span>
                  </td>
                  <td className="col-repo">
                    <code title={pr.repo}>{pr.repo}</code>
                  </td>
                  <td className="col-branches">
                    <code className="branch" title={pr.headRefName}>
                      {pr.headRefName}
                    </code>
                    <span className="branch-arrow" aria-hidden="true">
                      →
                    </span>
                    <code className="branch" title={pr.baseRefName}>
                      {pr.baseRefName}
                    </code>
                  </td>
                  <td className="col-state">
                    <span className={`badge badge-${pr.state.toLowerCase()}`}>{pr.state}</span>
                    {conflicting && <span className="badge badge-conflict">conflito</span>}
                  </td>
                  <td className="col-date">{formatShortDate(pr.updatedAt)}</td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      {!loading && hasMore && (
        <div className="load-more">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onLoadMore}
            disabled={loadingMore}
          >
            {loadingMore ? 'Carregando…' : 'Carregar mais'}
          </button>
        </div>
      )}
    </div>
  )
}
