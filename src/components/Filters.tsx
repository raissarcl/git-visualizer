import { useRef, useState } from 'react'
import type { AgeFilterDays } from '../domain/filters'
import type { StateFilter } from '../domain/pullRequest'

interface FiltersProps {
  mineOnly: boolean
  onMineOnlyChange: (value: boolean) => void
  state: StateFilter
  onStateChange: (value: StateFilter) => void
  query: string
  onQueryChange: (value: string) => void
  notesOnly: boolean
  onNotesOnlyChange: (value: boolean) => void
  conflictOnly: boolean
  onConflictOnlyChange: (value: boolean) => void
  minOpenDays: AgeFilterDays
  onMinOpenDaysChange: (value: AgeFilterDays) => void
  loaded: number
  hasMore: boolean
  onExport: () => void
  onImportFile: (file: File) => Promise<void>
}

export function Filters({
  mineOnly,
  onMineOnlyChange,
  state,
  onStateChange,
  query,
  onQueryChange,
  notesOnly,
  onNotesOnlyChange,
  conflictOnly,
  onConflictOnlyChange,
  minOpenDays,
  onMinOpenDaysChange,
  loaded,
  hasMore,
  onExport,
  onImportFile,
}: FiltersProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [importError, setImportError] = useState<string | null>(null)
  const [importOk, setImportOk] = useState(false)

  const advancedActive = state !== 'all' || minOpenDays > 0

  return (
    <div className="sidebar-filters">
      <div className="filters-top">
        <label className="filter-field filter-field-search">
          <span className="sr-only">Busca</span>
          <input
            type="search"
            placeholder="Buscar PRs…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
        </label>

        <div className="filter-chips" role="group" aria-label="Filtros rápidos">
          <label className={`filter-chip${mineOnly ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={mineOnly}
              onChange={(e) => onMineOnlyChange(e.target.checked)}
            />
            <span>Meus</span>
          </label>
          <label className={`filter-chip${notesOnly ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={notesOnly}
              onChange={(e) => onNotesOnlyChange(e.target.checked)}
            />
            <span>Notas</span>
          </label>
          <label className={`filter-chip${conflictOnly ? ' is-on' : ''}`}>
            <input
              type="checkbox"
              checked={conflictOnly}
              onChange={(e) => onConflictOnlyChange(e.target.checked)}
            />
            <span>Conflito</span>
          </label>
        </div>

        <p className="filters-count">
          {loaded} PR{loaded === 1 ? '' : 's'}
          {hasMore ? '+' : ''}
        </p>
      </div>

      <details className="filters-details">
        <summary>
          Mais filtros
          {advancedActive && <span className="filters-details-dot" aria-hidden="true" />}
        </summary>
        <div className="filters-details-body filters-grid">
          <label className="filter-field">
            <span>Estado</span>
            <select
              value={state}
              onChange={(e) => onStateChange(e.target.value as StateFilter)}
            >
              <option value="all">Todos</option>
              <option value="OPEN">Open</option>
              <option value="MERGED">Merged</option>
              <option value="CLOSED">Closed</option>
            </select>
          </label>

          <label className="filter-field">
            <span>Abertos &gt;</span>
            <select
              value={String(minOpenDays)}
              onChange={(e) => onMinOpenDaysChange(Number(e.target.value) as AgeFilterDays)}
            >
              <option value="0">—</option>
              <option value="3">3d</option>
              <option value="7">7d</option>
              <option value="14">14d</option>
              <option value="30">30d</option>
            </select>
          </label>
        </div>
      </details>

      <details className="filters-details">
        <summary>Backup local</summary>
        <div className="filters-details-body">
          <p className="filters-backup-hint">Notas, pins e pastas · sem token</p>
          <div className="filters-backup-actions">
            <button type="button" className="btn-backup" onClick={onExport}>
              Exportar
            </button>
            <button
              type="button"
              className="btn-backup"
              onClick={() => {
                setImportError(null)
                setImportOk(false)
                fileRef.current?.click()
              }}
            >
              Importar
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                onImportFile(file)
                  .then(() => {
                    setImportError(null)
                    setImportOk(true)
                  })
                  .catch((err) => {
                    setImportOk(false)
                    setImportError(err instanceof Error ? err.message : 'Falha ao importar.')
                  })
              }}
            />
          </div>
          {importOk && <p className="filters-backup-ok">Backup importado.</p>}
          {importError && <p className="filters-backup-error">{importError}</p>}
        </div>
      </details>
    </div>
  )
}
