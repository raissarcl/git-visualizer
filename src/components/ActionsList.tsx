import type { PeriodFilterDays, PrNotesMap } from '../domain/filters'
import type { ActionsStatusFilter, WorkflowRun } from '../domain/workflowRun'
import { actionNoteKey, runBadgeKind, runBadgeLabel, runKey } from '../domain/workflowRun'
import { hasNote } from '../storage/notes'

interface ActionsListProps {
  runs: WorkflowRun[]
  selectedId: string | null
  onSelect: (run: WorkflowRun) => void
  query: string
  onQueryChange: (value: string) => void
  statusFilter: ActionsStatusFilter
  onStatusFilterChange: (value: ActionsStatusFilter) => void
  withinDays: PeriodFilterDays
  onWithinDaysChange: (value: PeriodFilterDays) => void
  notesOnly: boolean
  onNotesOnlyChange: (value: boolean) => void
  notes: PrNotesMap
  loading?: boolean
  canDispatch: boolean
  dispatchDisabled?: boolean
  onDispatchClick: () => void
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ActionsList({
  runs,
  selectedId,
  onSelect,
  query,
  onQueryChange,
  statusFilter,
  onStatusFilterChange,
  withinDays,
  onWithinDaysChange,
  notesOnly,
  onNotesOnlyChange,
  notes,
  loading = false,
  canDispatch,
  dispatchDisabled = false,
  onDispatchClick,
}: ActionsListProps) {
  const showEmpty = !loading && runs.length === 0

  return (
    <div className="actions-panel">
      <div className="actions-toolbar-filters">
        <label className="filter-field filter-field-search actions-search">
          <span className="sr-only">Buscar runs</span>
          <input
            type="search"
            placeholder="Buscar runs…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            disabled={loading}
          />
        </label>
        <label className="filter-field actions-status-filter">
          <span className="sr-only">Status</span>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value as ActionsStatusFilter)}
            disabled={loading}
          >
            <option value="all">Todos</option>
            <option value="failure">Falhas</option>
            <option value="in_progress">Em andamento</option>
            <option value="success">Sucesso</option>
          </select>
        </label>
        <label className="filter-field actions-period-filter">
          <span className="sr-only">Período</span>
          <select
            value={String(withinDays)}
            onChange={(e) => onWithinDaysChange(Number(e.target.value) as PeriodFilterDays)}
            disabled={loading}
          >
            <option value="0">Todos</option>
            <option value="1">24h</option>
            <option value="7">7d</option>
            <option value="30">30d</option>
          </select>
        </label>
        <label className={`filter-chip${notesOnly ? ' is-on' : ''}`}>
          <input
            type="checkbox"
            checked={notesOnly}
            onChange={(e) => onNotesOnlyChange(e.target.checked)}
            disabled={loading}
          />
          <span>Notas</span>
        </label>
        {canDispatch && (
          <button
            type="button"
            className="btn btn-primary actions-dispatch-btn"
            onClick={onDispatchClick}
            disabled={dispatchDisabled}
          >
            Rodar workflow…
          </button>
        )}
      </div>

      <div className={`pr-list-wrap scrollable${loading ? ' is-loading' : ''}`} aria-busy={loading}>
        <table className="pr-list actions-list">
          <thead>
            <tr>
              <th className="col-state">Status</th>
              <th className="col-title">Workflow</th>
              <th className="col-repo">Repositório</th>
              <th className="col-branches">Branch</th>
              <th className="col-event">Evento</th>
              <th className="col-date">Quando</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr className="list-loading-row">
                <td colSpan={6}>
                  <span className="list-loading-label">Carregando Actions…</span>
                </td>
              </tr>
            ) : showEmpty ? (
              <tr className="list-empty-row">
                <td colSpan={6}>Nenhum run para mostrar com os filtros atuais.</td>
              </tr>
            ) : (
              runs.map((run) => {
                const key = runKey(run.repo, run.id)
                const noteKey = actionNoteKey(run.repo, run.id)
                const selected = selectedId === key
                const kind = runBadgeKind(run)
                const noted = hasNote(notes, noteKey)
                return (
                  <tr
                    key={key}
                    className={selected ? 'is-selected' : undefined}
                    onClick={() => onSelect(run)}
                  >
                    <td className="col-state">
                      <span className={`badge badge-run-${kind}`}>{runBadgeLabel(run)}</span>
                    </td>
                    <td className="col-title">
                      <span className="pr-title-row">
                        {noted && (
                          <span
                            className="note-dot"
                            title="Tem nota local"
                            aria-label="Tem nota local"
                          />
                        )}
                        <span className="pr-title" title={run.displayTitle}>
                          {run.displayTitle}
                        </span>
                      </span>
                      <span className="pr-author">
                        {run.name} · #{run.runNumber} · {run.actorLogin}
                      </span>
                    </td>
                    <td className="col-repo">
                      <code title={run.repo}>{run.repo}</code>
                    </td>
                    <td className="col-branches">
                      <code className="branch" title={run.headBranch}>
                        {run.headBranch || '—'}
                      </code>
                    </td>
                    <td className="col-event">
                      <span className="run-event">{run.event}</span>
                    </td>
                    <td className="col-date">{formatShortDate(run.createdAt)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
