import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addReposToFolder,
  addRepoToFolder,
  cloneLayout,
  createFolder,
  deleteFolder,
  isRepoHidden,
  isRepoInFolder,
  isRepoUncategorized,
  layoutsEqual,
  removeReposFromFolder,
  removeRepoFromFolder,
  renameFolder,
  setRepoHidden,
  type RepoFolder,
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

function FolderNavItem({
  folder,
  depth,
  active,
  renamingId,
  renameValue,
  draft,
  setActive,
  setRenamingId,
  setRenameValue,
  setDraft,
  commitRename,
}: {
  folder: RepoFolder
  depth: number
  active: ActiveTarget
  renamingId: string | null
  renameValue: string
  draft: RepoLayout
  setActive: (id: ActiveTarget) => void
  setRenamingId: (id: string | null) => void
  setRenameValue: (value: string) => void
  setDraft: (layout: RepoLayout) => void
  commitRename: () => void
}) {
  const children = draft.folders.filter((f) => f.parentId === folder.id)

  return (
    <li>
      {renamingId === folder.id ? (
        <div className="org-folder-rename" style={{ paddingLeft: `${depth * 12}px` }}>
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
          style={{ paddingLeft: `${depth * 12}px` }}
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
            title="Apagar (inclui subpastas)"
            onClick={() => {
              const next = deleteFolder(draft, folder.id)
              setDraft(next)
              if (
                active !== 'uncategorized' &&
                !next.folders.some((f) => f.id === active)
              ) {
                setActive('uncategorized')
              }
            }}
          >
            ×
          </button>
        </div>
      )}
      {children.length > 0 && (
        <ul className="org-folder-nav-nested">
          {children.map((child) => (
            <FolderNavItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              active={active}
              renamingId={renamingId}
              renameValue={renameValue}
              draft={draft}
              setActive={setActive}
              setRenamingId={setRenamingId}
              setRenameValue={setRenameValue}
              setDraft={setDraft}
              commitRename={commitRename}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function RepoOrganizer({ open, repos, layout, onChange, onClose }: RepoOrganizerProps) {
  const [draft, setDraft] = useState<RepoLayout>(() => cloneLayout(layout))
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [filter, setFilter] = useState('')
  const [active, setActive] = useState<ActiveTarget>('uncategorized')
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(cloneLayout(layout))
      setNewFolderName('')
      setRenamingId(null)
      setRenameValue('')
      setFilter('')
      setActive('uncategorized')
    }

    wasOpen.current = open
  }, [open, layout])

  useEffect(() => {
    if (!open) return
    if (active !== 'uncategorized' && !draft.folders.some((f) => f.id === active)) {
      setActive('uncategorized')
    }
  }, [open, active, draft.folders])

  const filteredRepos = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const base =
      active === 'uncategorized'
        ? repos.filter((r) => isRepoUncategorized(draft, r))
        : repos

    if (!q) return base
    return base.filter((r) => r.toLowerCase().includes(q))
  }, [repos, filter, active, draft])

  const rootFolders = useMemo(
    () => draft.folders.filter((f) => f.parentId === null),
    [draft.folders],
  )

  const dirty = !layoutsEqual(draft, layout)

  if (!open) return null

  const createParentId = active === 'uncategorized' ? null : active

  const handleCreateFolder = () => {
    const trimmed = newFolderName.trim()
    if (!trimmed) return
    const next = createFolder(draft, trimmed, createParentId)
    setDraft(next)
    const created = next.folders[next.folders.length - 1]
    if (created) setActive(created.id)
    setNewFolderName('')
  }

  const commitRename = () => {
    if (renamingId) {
      setDraft(renameFolder(draft, renamingId, renameValue))
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const requestClose = () => {
    if (dirty && !window.confirm('Descartar alterações não salvas?')) return
    onClose()
  }

  const handleSave = () => {
    onChange(draft)
    onClose()
  }

  const isInActiveFolder = (repo: string): boolean => {
    if (active === 'uncategorized') return isRepoUncategorized(draft, repo)
    return isRepoInFolder(draft, repo, active)
  }

  const toggleInActiveFolder = (repo: string, checked: boolean) => {
    if (active === 'uncategorized') return
    setDraft(
      checked
        ? addRepoToFolder(draft, repo, active)
        : removeRepoFromFolder(draft, repo, active),
    )
  }

  const selectAllInFolder = () => {
    if (active === 'uncategorized') return
    setDraft(addReposToFolder(draft, filteredRepos, active))
  }

  const clearAllInFolder = () => {
    if (active === 'uncategorized') return
    const toClear = filteredRepos.filter((r) => isRepoInFolder(draft, r, active))
    setDraft(removeReposFromFolder(draft, toClear, active))
  }

  const activeFolder =
    active === 'uncategorized' ? null : draft.folders.find((f) => f.id === active)

  const activeLabel = active === 'uncategorized' ? 'Sem pasta' : (activeFolder?.name ?? 'Pasta')

  const canBulk = active !== 'uncategorized'

  const createPlaceholder =
    active === 'uncategorized'
      ? 'Nova pasta na raiz…'
      : `Subpasta em ${activeFolder?.name ?? 'pasta'}…`

  return (
    <div className="org-overlay" role="presentation" onClick={requestClose}>
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
          <button type="button" className="detail-close" onClick={requestClose} aria-label="Fechar">
            ×
          </button>
        </header>

        <div className="org-split">
          <aside className="org-pane org-pane-folders">
            <h3>Pastas</h3>
            <div className="org-folder-create">
              <input
                type="text"
                placeholder={createPlaceholder}
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
              {rootFolders.map((folder) => (
                <FolderNavItem
                  key={folder.id}
                  folder={folder}
                  depth={0}
                  active={active}
                  renamingId={renamingId}
                  renameValue={renameValue}
                  draft={draft}
                  setActive={setActive}
                  setRenamingId={setRenamingId}
                  setRenameValue={setRenameValue}
                  setDraft={setDraft}
                  commitRename={commitRename}
                />
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
                ? 'Repos sem nenhuma pasta. Selecione uma pasta à esquerda e marque repos para adicioná-los (um repo pode estar em várias pastas).'
                : 'Marque repos nesta pasta (ou use Selecionar todos). Visível controla a sidebar. Desmarcar remove só desta pasta.'}
            </p>
            <ul className="org-repo-list scrollable">
              {filteredRepos.length === 0 ? (
                <li className="org-empty">Nenhum repo encontrado.</li>
              ) : (
                filteredRepos.map((repo) => {
                  const inFolder = isInActiveFolder(repo)
                  const visible = !isRepoHidden(draft, repo)
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
                        onClick={() => setDraft(setRepoHidden(draft, repo, visible))}
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
          <button type="button" className="btn" onClick={requestClose}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={!dirty}>
            Salvar
          </button>
        </footer>
      </div>
    </div>
  )
}
