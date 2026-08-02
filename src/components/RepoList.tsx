import { useState, type DragEvent } from 'react'
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
  buildSidebarTree,
  moveFolder,
  moveRepo,
  type FolderTreeNode,
  type RepoLayout,
  type SidebarScope,
} from '../storage/repoLayout'

interface RepoListProps {
  repos: string[]
  layout: RepoLayout
  scope: SidebarScope
  onSelectScope: (scope: SidebarScope) => void
  onToggleFolder: (folderId: string) => void
  onLayoutChange: (layout: RepoLayout) => void
  onOrganize: () => void
  loadedCount: number
}

type DropHint =
  | { kind: 'folder'; id: string; mode: 'before' | 'after' | 'into' }
  | {
      kind: 'repo'
      name: string
      folderId: string | null
      mode: 'before' | 'after'
    }
  | { kind: 'uncategorized' }
  | null

function isRepoActive(scope: SidebarScope, name: string): boolean {
  return scope.type === 'repo' && scope.name === name
}

function isFolderActive(scope: SidebarScope, id: string): boolean {
  return scope.type === 'folder' && scope.id === id
}

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

function FolderBlock({
  node,
  depth,
  scope,
  layout,
  siblingIds,
  onSelectScope,
  onToggleFolder,
  onLayoutChange,
  loadedCount,
  dragPayload,
  setDragPayload,
  dropHint,
  setDropHint,
}: {
  node: FolderTreeNode
  depth: number
  scope: SidebarScope
  layout: RepoLayout
  siblingIds: string[]
  onSelectScope: (scope: SidebarScope) => void
  onToggleFolder: (folderId: string) => void
  onLayoutChange: (layout: RepoLayout) => void
  loadedCount: number
  dragPayload: DndPayload | null
  setDragPayload: (p: DndPayload | null) => void
  dropHint: DropHint
  setDropHint: (h: DropHint) => void
}) {
  const folder = node.folder
  const collapsed = Boolean(folder.collapsed)
  const folderActive = isFolderActive(scope, folder.id)
  const indent = depth * 12
  const childIds = node.children.map((c) => c.folder.id)

  const isDragging =
    dragPayload?.kind === 'folder' && dragPayload.id === folder.id
  const hintHere =
    dropHint?.kind === 'folder' && dropHint.id === folder.id
      ? dropHint.mode
      : null

  const handleFolderDragStart = (e: DragEvent) => {
    const payload: DndPayload = { kind: 'folder', id: folder.id }
    setDndPayload(e.dataTransfer, payload)
    setDragPayload(payload)
  }

  const handleFolderDragOver = (e: DragEvent) => {
    if (!dragPayload) return
    allowDrop(e)
    if (dragPayload.kind === 'folder' && dragPayload.id === folder.id) {
      setDropHint(null)
      return
    }
    if (dragPayload.kind === 'folder') {
      setDropHint({
        kind: 'folder',
        id: folder.id,
        mode: folderDropMode(e, e.currentTarget as HTMLElement),
      })
    } else {
      setDropHint({ kind: 'folder', id: folder.id, mode: 'into' })
    }
  }

  const handleFolderDrop = (e: DragEvent) => {
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
        const kids = layout.folders.filter((f) => f.parentId === folder.id)
        onLayoutChange(moveFolder(layout, payload.id, folder.id, kids.length))
        return
      }
      const index = siblingInsertIndex(siblingIds, payload.id, folder.id, mode)
      onLayoutChange(moveFolder(layout, payload.id, folder.parentId, index))
      return
    }

    // repo → into this folder
    onLayoutChange(
      moveRepo(
        layout,
        payload.name,
        payload.fromFolderId,
        folder.id,
        node.repos.length,
      ),
    )
  }

  const handleRepoDragStart = (e: DragEvent, name: string) => {
    const payload: DndPayload = {
      kind: 'repo',
      name,
      fromFolderId: folder.id,
    }
    setDndPayload(e.dataTransfer, payload)
    setDragPayload(payload)
  }

  const handleRepoDragOver = (e: DragEvent, name: string) => {
    if (!dragPayload || dragPayload.kind !== 'repo') return
    allowDrop(e)
    e.stopPropagation()
    setDropHint({
      kind: 'repo',
      name,
      folderId: folder.id,
      mode: dropPositionFromEvent(e, e.currentTarget as HTMLElement),
    })
  }

  const handleRepoDrop = (e: DragEvent, targetName: string) => {
    e.preventDefault()
    e.stopPropagation()
    const payload = getDndPayload(e.dataTransfer) ?? dragPayload
    setDropHint(null)
    setDragPayload(null)
    if (!payload || payload.kind !== 'repo') return

    const mode = dropPositionFromEvent(e, e.currentTarget as HTMLElement)
    const index = repoInsertIndex(node.repos, payload.name, targetName, mode)
    onLayoutChange(
      moveRepo(layout, payload.name, payload.fromFolderId, folder.id, index),
    )
  }

  return (
    <li className={`repo-folder-block${isDragging ? ' is-dragging' : ''}`}>
      <div
        className={`repo-folder-header-row${folderActive ? ' is-active' : ''}${
          hintHere === 'before'
            ? ' is-drop-before'
            : hintHere === 'after'
              ? ' is-drop-after'
              : hintHere === 'into'
                ? ' is-drop-target'
                : ''
        }`}
        style={{ paddingLeft: indent > 0 ? `${indent}px` : undefined }}
        draggable
        onDragStart={handleFolderDragStart}
        onDragEnd={() => {
          setDragPayload(null)
          setDropHint(null)
        }}
        onDragOver={handleFolderDragOver}
        onDragLeave={() => {
          if (dropHint?.kind === 'folder' && dropHint.id === folder.id) {
            setDropHint(null)
          }
        }}
        onDrop={handleFolderDrop}
      >
        <button
          type="button"
          className="repo-folder-chevron-btn"
          onClick={() => onToggleFolder(folder.id)}
          aria-expanded={!collapsed}
          title={collapsed ? 'Expandir' : 'Recolher'}
        >
          {collapsed ? '▸' : '▾'}
        </button>
        <button
          type="button"
          className="repo-folder-select"
          onClick={() => onSelectScope({ type: 'folder', id: folder.id })}
          title={`Ver PRs de ${folder.name}`}
        >
          <span className="repo-folder-label">{folder.name}</span>
          <span className="repo-item-count">
            {folderActive ? loadedCount : node.repos.length}
          </span>
        </button>
      </div>
      {!collapsed && (
        <ul
          className="repo-folder-items"
          onDragOver={(e) => {
            if (!dragPayload) return
            allowDrop(e)
            if (dragPayload.kind === 'repo') {
              setDropHint({ kind: 'folder', id: folder.id, mode: 'into' })
            } else if (dragPayload.id !== folder.id) {
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
              const kids = layout.folders.filter(
                (f) => f.parentId === folder.id,
              )
              onLayoutChange(
                moveFolder(layout, payload.id, folder.id, kids.length),
              )
              return
            }
            onLayoutChange(
              moveRepo(
                layout,
                payload.name,
                payload.fromFolderId,
                folder.id,
                node.repos.length,
              ),
            )
          }}
        >
          {node.children.map((child) => (
            <FolderBlock
              key={child.folder.id}
              node={child}
              depth={depth + 1}
              scope={scope}
              layout={layout}
              siblingIds={childIds}
              onSelectScope={onSelectScope}
              onToggleFolder={onToggleFolder}
              onLayoutChange={onLayoutChange}
              loadedCount={loadedCount}
              dragPayload={dragPayload}
              setDragPayload={setDragPayload}
              dropHint={dropHint}
              setDropHint={setDropHint}
            />
          ))}
          {node.repos.length === 0 && node.children.length === 0 ? (
            <li className="repo-folder-empty">Vazia</li>
          ) : (
            node.repos.map((name) => {
              const repoHint =
                dropHint?.kind === 'repo' &&
                dropHint.folderId === folder.id &&
                dropHint.name === name
                  ? dropHint.mode
                  : null
              const repoDragging =
                dragPayload?.kind === 'repo' && dragPayload.name === name
              return (
                <li
                  key={name}
                  className={`${repoDragging ? 'is-dragging' : ''}${
                    repoHint === 'before'
                      ? ' is-drop-before'
                      : repoHint === 'after'
                        ? ' is-drop-after'
                        : ''
                  }`}
                  draggable
                  onDragStart={(e) => handleRepoDragStart(e, name)}
                  onDragEnd={() => {
                    setDragPayload(null)
                    setDropHint(null)
                  }}
                  onDragOver={(e) => handleRepoDragOver(e, name)}
                  onDrop={(e) => handleRepoDrop(e, name)}
                >
                  <button
                    type="button"
                    className={`repo-item repo-item-nested${isRepoActive(scope, name) ? ' is-active' : ''}`}
                    onClick={() => onSelectScope({ type: 'repo', name })}
                    title={name}
                  >
                    <span className="repo-item-name">{name}</span>
                    <span className="repo-item-count">
                      {isRepoActive(scope, name) ? loadedCount : '—'}
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      )}
    </li>
  )
}

export function RepoList({
  repos,
  layout,
  scope,
  onSelectScope,
  onToggleFolder,
  onLayoutChange,
  onOrganize,
  loadedCount,
}: RepoListProps) {
  const tree = buildSidebarTree(repos, layout)
  const networkActive = scope.type === 'network'
  const [dragPayload, setDragPayload] = useState<DndPayload | null>(null)
  const [dropHint, setDropHint] = useState<DropHint>(null)
  const rootIds = tree.roots.map((n) => n.folder.id)

  const handleUncategorizedRepoDragStart = (e: DragEvent, name: string) => {
    const payload: DndPayload = {
      kind: 'repo',
      name,
      fromFolderId: null,
    }
    setDndPayload(e.dataTransfer, payload)
    setDragPayload(payload)
  }

  const handleUncategorizedRepoDrop = (e: DragEvent, targetName: string) => {
    e.preventDefault()
    e.stopPropagation()
    const payload = getDndPayload(e.dataTransfer) ?? dragPayload
    setDropHint(null)
    setDragPayload(null)
    if (!payload || payload.kind !== 'repo') return
    const mode = dropPositionFromEvent(e, e.currentTarget as HTMLElement)
    const index = repoInsertIndex(
      tree.uncategorized,
      payload.name,
      targetName,
      mode,
    )
    onLayoutChange(
      moveRepo(layout, payload.name, payload.fromFolderId, null, index),
    )
  }

  return (
    <div className="repo-list">
      <div className="repo-list-header">
        <h2 className="sidebar-heading">Repositórios</h2>
        <button type="button" className="btn-organize" onClick={onOrganize}>
          Organizar
        </button>
      </div>
      <ul className="repo-list-items scrollable">
        <li>
          <button
            type="button"
            className={`repo-item${networkActive ? ' is-active' : ''}`}
            onClick={() => onSelectScope({ type: 'network' })}
          >
            <span className="repo-item-name">Sua rede</span>
            <span className="repo-item-count">
              {networkActive ? loadedCount : '—'}
            </span>
          </button>
        </li>

        {tree.roots.map((node) => (
          <FolderBlock
            key={node.folder.id}
            node={node}
            depth={0}
            scope={scope}
            layout={layout}
            siblingIds={rootIds}
            onSelectScope={onSelectScope}
            onToggleFolder={onToggleFolder}
            onLayoutChange={onLayoutChange}
            loadedCount={loadedCount}
            dragPayload={dragPayload}
            setDragPayload={setDragPayload}
            dropHint={dropHint}
            setDropHint={setDropHint}
          />
        ))}

        <li
          className={`repo-uncategorized-zone${
            dropHint?.kind === 'uncategorized' ? ' is-drop-target' : ''
          }`}
          onDragOver={(e) => {
            if (!dragPayload) return
            // Pastas soltas aqui vão para a raiz; repos ficam sem pasta
            allowDrop(e)
            setDropHint({ kind: 'uncategorized' })
          }}
          onDragLeave={() => {
            if (dropHint?.kind === 'uncategorized') setDropHint(null)
          }}
          onDrop={(e) => {
            e.preventDefault()
            const payload = getDndPayload(e.dataTransfer) ?? dragPayload
            setDropHint(null)
            setDragPayload(null)
            if (!payload) return
            if (payload.kind === 'folder') {
              onLayoutChange(
                moveFolder(layout, payload.id, null, rootIds.length),
              )
              return
            }
            onLayoutChange(
              moveRepo(
                layout,
                payload.name,
                payload.fromFolderId,
                null,
                tree.uncategorized.length,
              ),
            )
          }}
        >
          {tree.uncategorized.length === 0 && dragPayload ? (
            <span className="repo-uncategorized-hint">Soltar sem pasta</span>
          ) : null}
          <ul className="repo-uncategorized-list">
            {tree.uncategorized.map((name) => {
              const repoHint =
                dropHint?.kind === 'repo' &&
                dropHint.folderId === null &&
                dropHint.name === name
                  ? dropHint.mode
                  : null
              const repoDragging =
                dragPayload?.kind === 'repo' && dragPayload.name === name
              return (
                <li
                  key={name}
                  className={`${repoDragging ? 'is-dragging' : ''}${
                    repoHint === 'before'
                      ? ' is-drop-before'
                      : repoHint === 'after'
                        ? ' is-drop-after'
                        : ''
                  }`}
                  draggable
                  onDragStart={(e) => handleUncategorizedRepoDragStart(e, name)}
                  onDragEnd={() => {
                    setDragPayload(null)
                    setDropHint(null)
                  }}
                  onDragOver={(e) => {
                    if (!dragPayload || dragPayload.kind !== 'repo') return
                    allowDrop(e)
                    e.stopPropagation()
                    setDropHint({
                      kind: 'repo',
                      name,
                      folderId: null,
                      mode: dropPositionFromEvent(
                        e,
                        e.currentTarget as HTMLElement,
                      ),
                    })
                  }}
                  onDrop={(e) => handleUncategorizedRepoDrop(e, name)}
                >
                  <button
                    type="button"
                    className={`repo-item${isRepoActive(scope, name) ? ' is-active' : ''}`}
                    onClick={() => onSelectScope({ type: 'repo', name })}
                    title={name}
                  >
                    <span className="repo-item-name">{name}</span>
                    <span className="repo-item-count">
                      {isRepoActive(scope, name) ? loadedCount : '—'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </li>
      </ul>
    </div>
  )
}
