import type { DragEvent } from 'react'

/**
 * HTML5 drag-and-drop helpers for sidebar / organizer tree.
 */

export const DND_MIME = 'application/x-visualize-git-dnd'

export type DndFolderPayload = {
  kind: 'folder'
  id: string
}

export type DndRepoPayload = {
  kind: 'repo'
  name: string
  /** null = uncategorized / sem pasta */
  fromFolderId: string | null
}

export type DndPayload = DndFolderPayload | DndRepoPayload

export type DropPosition = 'before' | 'after' | 'into'

export function setDndPayload(
  dataTransfer: DataTransfer,
  payload: DndPayload,
): void {
  const json = JSON.stringify(payload)
  dataTransfer.setData(DND_MIME, json)
  // Firefox requires a text/plain fallback for some drops
  dataTransfer.setData('text/plain', json)
  dataTransfer.effectAllowed = 'move'
}

export function getDndPayload(dataTransfer: DataTransfer): DndPayload | null {
  const raw =
    dataTransfer.getData(DND_MIME) || dataTransfer.getData('text/plain')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const obj = parsed as Record<string, unknown>
    if (obj.kind === 'folder' && typeof obj.id === 'string') {
      return { kind: 'folder', id: obj.id }
    }
    if (
      obj.kind === 'repo' &&
      typeof obj.name === 'string' &&
      (obj.fromFolderId === null || typeof obj.fromFolderId === 'string')
    ) {
      return {
        kind: 'repo',
        name: obj.name,
        fromFolderId: obj.fromFolderId as string | null,
      }
    }
    return null
  } catch {
    return null
  }
}

/** Drop before vs after based on pointer Y within the element. */
export function dropPositionFromEvent(
  event: { clientY: number },
  element: HTMLElement,
): 'before' | 'after' {
  const rect = element.getBoundingClientRect()
  const mid = rect.top + rect.height / 2
  return event.clientY < mid ? 'before' : 'after'
}

/**
 * Índice final entre irmãos após remoção do item arrastado.
 * `targetIndex` é o índice visual do alvo; `position` before/after.
 */
export function siblingInsertIndex(
  siblingIds: string[],
  draggedId: string,
  targetId: string,
  position: 'before' | 'after',
): number {
  const without = siblingIds.filter((id) => id !== draggedId)
  const targetIdx = without.indexOf(targetId)
  if (targetIdx === -1) return without.length
  return position === 'before' ? targetIdx : targetIdx + 1
}

export function repoInsertIndex(
  ordered: string[],
  draggedName: string,
  targetName: string,
  position: 'before' | 'after',
): number {
  return siblingInsertIndex(ordered, draggedName, targetName, position)
}

export function allowDrop(event: DragEvent): void {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
}
