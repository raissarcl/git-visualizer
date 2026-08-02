import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import {
  allowDrop,
  dropPositionFromEvent,
  getDndPayload,
  repoInsertIndex,
  setDndPayload,
  siblingInsertIndex,
  type DndPayload,
} from './dnd'
import {
  addReposToFolder,
  addRepoToFolder,
  applyRepoOrder,
  cloneLayout,
  createFolder,
  deleteFolder,
  isRepoHidden,
  isRepoInFolder,
  isRepoUncategorized,
  layoutsEqual,
  moveFolder,
  moveRepo,
  removeReposFromFolder,
  removeRepoFromFolder,
  renameFolder,
  reorderReposInFolder,
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

type DropHint =
  | { kind: 'folder'; id: string; mode: 'before' | 'after' | 'into' }
  | { kind: 'repo'; name: string; mode: 'before' | 'after' }
  | null

function folderDropMode(
  event: { clientY: number },
  element: HTMLElement,
): 'before' | 'after' | 'into' {
  const rect = element.getBoundingClientRect()
  const y = event.clientY - rect.top
  const h = rect.height || 1
  if (y < h / 3) return 'before'
  if (y > (2 * h) / 3) return 'after'
  return 'into'
}

function FolderNavItem({
  folder,
  depth,
  active,
  renamingId,
  renameValue,
  draft,
  siblingIds,
  dragPayload,
  dropHint,
  setActive,
  setRenamingId,
  setRenameValue,
  setDraft,
  commitRename,
  setDragPayload,
  setDropHint,
}: {
  folder: RepoFolder
  depth: number
  active: ActiveTarget
  renamingId: string | null
  renameValue: string
  draft: RepoLayout
  siblingIds: string[]
  dragPayload: DndPayload | null
  dropHint: DropHint
  setActive: (id: ActiveTarget) => void
  setRenamingId: (id: string | null) => void
  setRenameValue: (value: string) => void
  setDraft: (layout: RepoLayout) => void
  commitRename: () => void
  setDragPayload: (p: DndPayload | null) => void
  setDropHint: (h: DropHint) => void
}) {
  const children = draft.folders.filter((f) => f.parentId === folder.id)
  const childIds = children.map((c) => c.id)
  const isDragging =
    dragPayload?.kind === 'folder' && dragPayload.id === folder.id
  const hintHere =
    dropHint?.kind === 'folder' && dropHint.id === folder.id
      ? dropHint.mode
      : null

  return (
    <li className={isDragging ? 'is-dragging' : undefined}>
      {renamingId === folder.id ? (
        <div
          className="org-folder-rename"
          style={{ paddingLeft: `${depth * 12}px` }}
        >
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
          className={`org-folder-nav-row${active === folder.id ? ' is-active' : ''}${
            hintHere === 'before'
              ? ' is-drop-before'
              : hintHere === 'after'
                ? ' is-drop-after'
                : hintHere === 'into'
                  ? ' is-drop-target'
                  : ''
          }`}
          style={{ paddingLeft: `${depth * 12}px` }}
          draggable
          onDragStart={(e) => {
            const payload: DndPayload = { kind: 'folder', id: folder.id }
            setDndPayload(e.dataTransfer, payload)
            setDragPayload(payload)
          }}
          onDragEnd={() => {
            setDragPayload(null)
            setDropHint(null)
          }}
          onDragOver={(e) => {
            if (!dragPayload) return
            allowDrop(e)
            e.stopPropagation()
            if (dragPayload.kind === 'folder') {
              if (dragPayload.id === folder.id) {
                setDropHint(null)
                return
              }
              setDropHint({
                kind: 'folder',
                id: folder.id,
                mode: folderDropMode(e, e.currentTarget as HTMLElement),
              })
            } else {
              setDropHint({ kind: 'folder', id: folder.id, mode: 'into' })
            }
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const payload = getDndPayload(e.dataTransfer) ?? dragPayload
            setDropHint(null)
            setDragPayload(null)
            if (!payload) return

            if (payload.kind === 'folder') {
              if (payload.id === folder.id) return
              const mode = folderDropMode(e, e.currentTarget as HTMLElement)
              if (mode === 'into') {
                const kids = draft.folders.filter(
                  (f) => f.parentId === folder.id,
                )
                setDraft(moveFolder(draft, payload.id, folder.id, kids.length))
                return
              }
              const index = siblingInsertIndex(
                siblingIds,
                payload.id,
                folder.id,
                mode,
              )
              setDraft(moveFolder(draft, payload.id, folder.parentId, index))
              return
            }

            // Move repo into this folder (from organizer list or cross-folder)
            const order = draft.repoOrderByFolder[folder.id] ?? []
            setDraft(
              moveRepo(
                draft,
                payload.name,
                payload.fromFolderId,
                folder.id,
                order.length,
              ),
            )
            setActive(folder.id)
          }}
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
              siblingIds={childIds}
              dragPayload={dragPayload}
              dropHint={dropHint}
              setActive={setActive}
              setRenamingId={setRenamingId}
              setRenameValue={setRenameValue}
              setDraft={setDraft}
              commitRename={commitRename}
              setDragPayload={setDragPayload}
              setDropHint={setDropHint}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function RepoOrganizer({
  open,
  repos,
  layout,
  onChange,
  onClose,
}: RepoOrganizerProps) {
  const [draft, setDraft] = useState<RepoLayout>(() => cloneLayout(layout))
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [filter, setFilter] = useState('')
  const [active, setActive] = useState<ActiveTarget>('uncategorized')
  const [dragPayload, setDragPayload] = useState<DndPayload | null>(null)
  const [dropHint, setDropHint] = useState<DropHint>(null)
  const wasOpen = useRef(false)

  useEffect(() => {
    if (open && !wasOpen.current) {
      setDraft(cloneLayout(layout))
      setNewFolderName('')
      setRenamingId(null)
      setRenameValue('')
      setFilter('')
      setActive('uncategorized')
      setDragPayload(null)
      setDropHint(null)
    }

    wasOpen.current = open
  }, [open, layout])

  useEffect(() => {
    if (!open) return
    if (
      active !== 'uncategorized' &&
      !draft.folders.some((f) => f.id === active)
    ) {
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

  const orderedActiveRepos = useMemo(() => {
    if (active === 'uncategorized') {
      return applyRepoOrder(
        filteredRepos.filter((r) => isRepoUncategorized(draft, r)),
        draft.uncategorizedOrder,
      )
    }
    const inFolder = filteredRepos.filter((r) =>
      isRepoInFolder(draft, r, active),
    )
    return applyRepoOrder(inFolder, draft.repoOrderByFolder[active] ?? [])
  }, [active, draft, filteredRepos])

  const displayRepos = useMemo(() => {
    if (active === 'uncategorized') return orderedActiveRepos
    // When viewing a folder, show all filtered repos (for checkboxes) but
    // members first in custom order, then the rest alphabetically.
    const memberSet = new Set(orderedActiveRepos)
    const rest = filteredRepos
      .filter((r) => !memberSet.has(r))
      .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    return [...orderedActiveRepos, ...rest]
  }, [active, orderedActiveRepos, filteredRepos])

  const rootFolders = useMemo(
    () => draft.folders.filter((f) => f.parentId === null),
    [draft.folders],
  )
  const rootIds = rootFolders.map((f) => f.id)

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
    const toClear = filteredRepos.filter((r) =>
      isRepoInFolder(draft, r, active),
    )
    setDraft(removeReposFromFolder(draft, toClear, active))
  }

  const activeFolder =
    active === 'uncategorized'
      ? null
      : draft.folders.find((f) => f.id === active)

  const activeLabel =
    active === 'uncategorized' ? 'Sem pasta' : (activeFolder?.name ?? 'Pasta')

  const canBulk = active !== 'uncategorized'
  const canReorderRepos =
    filter.trim() === '' &&
    (active === 'uncategorized' ||
      displayRepos.some((r) => isRepoInFolder(draft, r, active as string)))

  const createPlaceholder =
    active === 'uncategorized'
      ? 'Nova pasta na raiz…'
      : `Subpasta em ${activeFolder?.name ?? 'pasta'}…`

  const handleRepoDragStart = (e: DragEvent, repo: string) => {
    if (!isInActiveFolder(repo) && active !== 'uncategorized') return
    const payload: DndPayload = {
      kind: 'repo',
      name: repo,
      fromFolderId: active === 'uncategorized' ? null : active,
    }
    setDndPayload(e.dataTransfer, payload)
    setDragPayload(payload)
  }

  const handleRepoDropOnRepo = (e: DragEvent, targetRepo: string) => {
    e.preventDefault()
    e.stopPropagation()
    const payload = getDndPayload(e.dataTransfer) ?? dragPayload
    setDropHint(null)
    setDragPayload(null)
    if (!payload || payload.kind !== 'repo') return
    if (!canReorderRepos) return
    if (
      active !== 'uncategorized' &&
      !isRepoInFolder(draft, targetRepo, active)
    ) {
      return
    }

    const mode = dropPositionFromEvent(e, e.currentTarget as HTMLElement)
    const ordered =
      active === 'uncategorized'
        ? applyRepoOrder(
            repos.filter((r) => isRepoUncategorized(draft, r)),
            draft.uncategorizedOrder,
          )
        : applyRepoOrder(
            repos.filter((r) => isRepoInFolder(draft, r, active)),
            draft.repoOrderByFolder[active] ?? [],
          )

    const index = repoInsertIndex(ordered, payload.name, targetRepo, mode)
    const folderId = active === 'uncategorized' ? null : active

    if (payload.fromFolderId === folderId) {
      const without = ordered.filter((r) => r !== payload.name)
      const insertAt = Math.max(0, Math.min(index, without.length))
      without.splice(insertAt, 0, payload.name)
      setDraft(reorderReposInFolder(draft, folderId, without))
      return
    }

    setDraft(
      moveRepo(draft, payload.name, payload.fromFolderId, folderId, index),
    )
  }

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
          <button
            type="button"
            className="detail-close"
            onClick={requestClose}
            aria-label="Fechar"
          >
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
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleCreateFolder}
              >
                Criar
              </button>
            </div>

            <ul className="org-folder-nav scrollable">
              <li>
                <button
                  type="button"
                  className={`org-folder-nav-item${active === 'uncategorized' ? ' is-active' : ''}`}
                  onClick={() => setActive('uncategorized')}
                  onDragOver={(e) => {
                    if (dragPayload?.kind !== 'repo') return
                    allowDrop(e)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const payload = getDndPayload(e.dataTransfer) ?? dragPayload
                    setDragPayload(null)
                    setDropHint(null)
                    if (!payload || payload.kind !== 'repo') return
                    setDraft(
                      moveRepo(
                        draft,
                        payload.name,
                        payload.fromFolderId,
                        null,
                        draft.uncategorizedOrder.length,
                      ),
                    )
                    setActive('uncategorized')
                  }}
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
                  siblingIds={rootIds}
                  dragPayload={dragPayload}
                  dropHint={dropHint}
                  setActive={setActive}
                  setRenamingId={setRenamingId}
                  setRenameValue={setRenameValue}
                  setDraft={setDraft}
                  commitRename={commitRename}
                  setDragPayload={setDragPayload}
                  setDropHint={setDropHint}
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
                <button
                  type="button"
                  className="btn"
                  onClick={selectAllInFolder}
                >
                  Selecionar todos
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={clearAllInFolder}
                >
                  Limpar seleção
                </button>
              </div>
            )}
            <p className="org-hint">
              {active === 'uncategorized'
                ? 'Repos sem nenhuma pasta. Arraste para reordenar ou solte numa pasta à esquerda. Um repo pode estar em várias pastas.'
                : 'Marque repos nesta pasta. Arraste membros para reordenar; solte numa pasta à esquerda para mover. Visível controla a sidebar.'}
            </p>
            <ul className="org-repo-list scrollable">
              {displayRepos.length === 0 ? (
                <li className="org-empty">Nenhum repo encontrado.</li>
              ) : (
                displayRepos.map((repo) => {
                  const inFolder = isInActiveFolder(repo)
                  const visible = !isRepoHidden(draft, repo)
                  const memberDraggable =
                    canReorderRepos && (active === 'uncategorized' || inFolder)
                  const repoHint =
                    dropHint?.kind === 'repo' && dropHint.name === repo
                      ? dropHint.mode
                      : null
                  const repoDragging =
                    dragPayload?.kind === 'repo' && dragPayload.name === repo

                  return (
                    <li
                      key={repo}
                      className={`org-repo-row-v2${repoDragging ? ' is-dragging' : ''}${
                        repoHint === 'before'
                          ? ' is-drop-before'
                          : repoHint === 'after'
                            ? ' is-drop-after'
                            : ''
                      }`}
                      draggable={memberDraggable}
                      onDragStart={(e) => {
                        if (!memberDraggable) {
                          e.preventDefault()
                          return
                        }
                        handleRepoDragStart(e, repo)
                      }}
                      onDragEnd={() => {
                        setDragPayload(null)
                        setDropHint(null)
                      }}
                      onDragOver={(e) => {
                        if (!dragPayload || dragPayload.kind !== 'repo') return
                        if (!memberDraggable || !inFolder) return
                        allowDrop(e)
                        setDropHint({
                          kind: 'repo',
                          name: repo,
                          mode: dropPositionFromEvent(
                            e,
                            e.currentTarget as HTMLElement,
                          ),
                        })
                      }}
                      onDrop={(e) => handleRepoDropOnRepo(e, repo)}
                    >
                      <label className="org-folder-check">
                        <input
                          type="checkbox"
                          checked={inFolder}
                          disabled={active === 'uncategorized'}
                          onChange={(e) =>
                            toggleInActiveFolder(repo, e.target.checked)
                          }
                        />
                        <span title={repo}>{repo}</span>
                      </label>
                      <button
                        type="button"
                        className={`btn-vis${visible ? ' is-on' : ''}`}
                        onClick={() =>
                          setDraft(setRepoHidden(draft, repo, visible))
                        }
                        title={
                          visible ? 'Ocultar da sidebar' : 'Mostrar na sidebar'
                        }
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
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!dirty}
          >
            Salvar
          </button>
        </footer>
      </div>
    </div>
  )
}
