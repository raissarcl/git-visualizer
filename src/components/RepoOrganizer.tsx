import { useEffect, useMemo, useState } from 'react'
import {
  assignRepoFolder,
  assignReposFolder,
  createFolder,
  deleteFolder,
  isRepoHidden,
  renameFolder,
  setRepoHidden,
  type RepoLayout,
} from '../storage/repoLayout'

type ActiveTarget = 'uncategorized' | string

interface RepoOrganizerProps {
  open: boolean
  repos: string[]
  layout: RepoLayout
  onChange: (layout: RepoLayout) => void
  onClose: () => void
}

export function RepoOrganizer({ open, repos, layout, onChange, onClose }: RepoOrganizerProps) {
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [filter, setFilter] = useState('')
  const [active, setActive] = useState<ActiveTarget>('uncategorized')

  useEffect(() => {
    if (!open) return
    if (active !== 'uncategorized' && !layout.folders.some((f) => f.id === active)) {
      setActive('uncategorized')
    }
  }, [open, active, layout.folders])

  const filteredRepos = useMemo(() => {
    const q = filter.trim().toLowerCase()
    if (!q) return repos
    return repos.filter((r) => r.toLowerCase().includes(q))
  }, [repos, filter])

  if (!open) return null

  const handleCreateFolder = () => {
    const trimmed = newFolderName.trim()
    if (!trimmed) return
    const next = createFolder(layout, trimmed)
    onChange(next)
    const created = next.folders[next.folders.length - 1]
    if (created) setActive(created.id)
    setNewFolderName('')
  }

  const commitRename = () => {
    if (renamingId) {
      onChange(renameFolder(layout, renamingId, renameValue))
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const isInActiveFolder = (repo: string): boolean => {
    const folderId = layout.folderByRepo[repo] ?? null
    if (active === 'uncategorized') return folderId === null
    return folderId === active
  }

  const toggleInActiveFolder = (repo: string, checked: boolean) => {
    if (active === 'uncategorized') {
      if (checked) onChange(assignRepoFolder(layout, repo, null))
      return
    }
    onChange(assignRepoFolder(layout, repo, checked ? active : null))
  }

  const selectAllInFolder = () => {
    if (active === 'uncategorized') return
    onChange(assignReposFolder(layout, filteredRepos, active))
  }

  const clearAllInFolder = () => {
    if (active === 'uncategorized') return
    const toClear = filteredRepos.filter((r) => layout.folderByRepo[r] === active)
    onChange(assignReposFolder(layout, toClear, null))
  }

  const activeLabel =
    active === 'uncategorized'
      ? 'Sem pasta'
      : (layout.folders.find((f) => f.id === active)?.name ?? 'Pasta')

  const canBulk = active !== 'uncategorized'

  return (
    <div className="org-overlay" role="presentation" onClick={onClose}>
      <div
        className="org-modal org-modal-split"
        role="dialog"
        aria-labelledby="org-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="org-header">
          <div>
            <h2 id="org-title">Organizar repositórios</h2>
            <p className="org-subtitle">{repos.length} repos disponíveis</p>
          </div>
          <button type="button" className="detail-close" onClick={onClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="org-split">
          <aside className="org-pane org-pane-folders">
            <h3>Pastas</h3>
            <div className="org-folder-create">
              <input
                type="text"
                placeholder="Nova pasta…"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder()
                }}
              />
              <button type="button" className="btn btn-primary" onClick={handleCreateFolder}>
                Criar
              </button>
            </div>

            <ul className="org-folder-nav scrollable">
              <li>
                <button
                  type="button"
                  className={`org-folder-nav-item${active === 'uncategorized' ? ' is-active' : ''}`}
                  onClick={() => setActive('uncategorized')}
                >
                  Sem pasta
                </button>
              </li>
              {layout.folders.map((folder) => (
                <li key={folder.id}>
                  {renamingId === folder.id ? (
                    <div className="org-folder-rename">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename()
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        autoFocus
                      />
                      <button type="button" className="btn" onClick={commitRename}>
                        OK
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`org-folder-nav-row${active === folder.id ? ' is-active' : ''}`}
                    >
                      <button
                        type="button"
                        className="org-folder-nav-item"
                        onClick={() => setActive(folder.id)}
                      >
                        {folder.name}
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        title="Renomear"
                        onClick={() => {
                          setRenamingId(folder.id)
                          setRenameValue(folder.name)
                        }}
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        title="Apagar"
                        onClick={() => {
                          onChange(deleteFolder(layout, folder.id))
                          if (active === folder.id) setActive('uncategorized')
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </aside>

          <section className="org-pane org-pane-repos">
            <h3>
              Repos em <em>{activeLabel}</em>
            </h3>
            <input
              type="search"
              className="org-repo-filter"
              placeholder="Buscar repos…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            {canBulk && (
              <div className="org-bulk-actions">
                <button type="button" className="btn" onClick={selectAllInFolder}>
                  Selecionar todos
                </button>
                <button type="button" className="btn" onClick={clearAllInFolder}>
                  Limpar seleção
                </button>
              </div>
            )}
            <p className="org-hint">
              {active === 'uncategorized'
                ? 'Repos sem pasta. Selecione uma pasta à esquerda e marque repos para adicioná-los.'
                : 'Marque repos (ou use Selecionar todos). Visível controla a sidebar.'}
            </p>
            <ul className="org-repo-list scrollable">
              {filteredRepos.length === 0 ? (
                <li className="org-empty">Nenhum repo encontrado.</li>
              ) : (
                filteredRepos.map((repo) => {
                  const inFolder = isInActiveFolder(repo)
                  const visible = !isRepoHidden(layout, repo)
                  return (
                    <li key={repo} className="org-repo-row-v2">
                      <label className="org-folder-check">
                        <input
                          type="checkbox"
                          checked={inFolder}
                          disabled={active === 'uncategorized'}
                          onChange={(e) => toggleInActiveFolder(repo, e.target.checked)}
                        />
                        <span title={repo}>{repo}</span>
                      </label>
                      <button
                        type="button"
                        className={`btn-vis${visible ? ' is-on' : ''}`}
                        onClick={() => onChange(setRepoHidden(layout, repo, visible))}
                        title={visible ? 'Ocultar da sidebar' : 'Mostrar na sidebar'}
                      >
                        {visible ? 'Visível' : 'Oculto'}
                      </button>
                    </li>
                  )
                })
              )}
            </ul>
          </section>
        </div>

        <footer className="org-footer">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Concluído
          </button>
        </footer>
      </div>
    </div>
  )
}
