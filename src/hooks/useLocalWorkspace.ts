/**
 * Dados locais do visualizador: notes, pins, layout, sidebar, workspace notes, backup.
 * Verificações de branch no remoto passam por aqui (não pelo App).
 */

import { useCallback, useState } from 'react'
import type { WorkspaceNote } from '../domain/workspaceNote'
import { checkRepoBranch, fetchRepoBranches } from '../github'
import {
  applyImportedData,
  clearLocalData,
  downloadLocalBackup,
  parseBackupJson,
} from '../storage/backup'
import {
  loadNotes,
  saveNotes,
  setNote,
  type PrNotesMap,
} from '../storage/notes'
import { loadPins, savePins, togglePin, type PinSet } from '../storage/pins'
import {
  loadSidebarCollapsed,
  saveSidebarCollapsed,
} from '../storage/preferences'
import {
  isRepoHidden,
  loadRepoLayout,
  saveRepoLayout,
  type RepoLayout,
  type SidebarScope,
} from '../storage/repoLayout'
import {
  loadWorkspaceNotes,
  removeWorkspaceNote,
  saveWorkspaceNotes,
  upsertWorkspaceNote,
} from '../storage/workspaceNotes'

function clampScope(scope: SidebarScope, layout: RepoLayout): SidebarScope {
  if (scope.type === 'repo' && isRepoHidden(layout, scope.name)) {
    return { type: 'network' }
  }

  if (
    scope.type === 'folder' &&
    !layout.folders.some((f) => f.id === scope.id)
  ) {
    return { type: 'network' }
  }

  return scope
}

export function useLocalWorkspace(token: string | null) {
  const [layout, setLayout] = useState<RepoLayout>(() => loadRepoLayout())
  const [organizerOpen, setOrganizerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed)

  const [notes, setNotes] = useState<PrNotesMap>(() => loadNotes())
  const [pins, setPins] = useState<PinSet>(() => loadPins())
  const [workspaceNotes, setWorkspaceNotes] = useState<WorkspaceNote[]>(() =>
    loadWorkspaceNotes(),
  )
  const [scope, setScope] = useState<SidebarScope>({ type: 'network' })

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      saveSidebarCollapsed(next)
      return next
    })
  }, [])

  const handleNoteChange = useCallback((key: string, text: string) => {
    setNotes((prev) => {
      const next = setNote(prev, key, text)
      saveNotes(next)
      return next
    })
  }, [])

  const handleTogglePin = useCallback((key: string) => {
    setPins((prev) => {
      const next = togglePin(prev, key)
      savePins(next)
      return next
    })
  }, [])

  const upsertNote = useCallback((note: WorkspaceNote) => {
    setWorkspaceNotes((prev) => {
      const next = upsertWorkspaceNote(prev, note)
      saveWorkspaceNotes(next)
      return next
    })
  }, [])

  const deleteNote = useCallback((id: string) => {
    setWorkspaceNotes((prev) => {
      const next = removeWorkspaceNote(prev, id)
      saveWorkspaceNotes(next)
      return next
    })
  }, [])

  const updateLayout = useCallback((next: RepoLayout) => {
    setLayout(next)
    saveRepoLayout(next)
    setScope((current) => clampScope(current, next))
  }, [])

  const handleImportFile = useCallback(async (file: File) => {
    const text = await file.text()
    const data = parseBackupJson(text)

    applyImportedData(data)

    setNotes(data.notes)
    setPins(data.pins)
    setLayout(data.repoLayout)
    setSidebarCollapsed(data.sidebarCollapsed)
    setWorkspaceNotes(data.workspaceNotes)
    setScope((current) => clampScope(current, data.repoLayout))
  }, [])

  const handleClearLocalData = useCallback(() => {
    const data = clearLocalData()
    setNotes(data.notes)
    setPins(data.pins)
    setLayout(data.repoLayout)
    setSidebarCollapsed(data.sidebarCollapsed)
    setWorkspaceNotes(data.workspaceNotes)
    setScope({ type: 'network' })
  }, [])

  const selectScope = useCallback((next: SidebarScope) => {
    setScope(next)
  }, [])

  const loadBranches = useCallback(
    async (repo: string) => {
      if (!token) return []
      return fetchRepoBranches(token, repo)
    },
    [token],
  )

  const checkBranch = useCallback(
    async (repo: string, branch: string) => {
      if (!token) {
        throw new Error(
          'Salve um Personal Access Token para verificar branches.',
        )
      }
      return checkRepoBranch(token, repo, branch)
    },
    [token],
  )

  return {
    layout,
    updateLayout,
    organizerOpen,
    setOrganizerOpen,
    sidebarCollapsed,
    toggleSidebar,
    notes,
    pins,
    workspaceNotes,
    upsertNote,
    deleteNote,
    handleNoteChange,
    handleTogglePin,
    scope,
    selectScope,
    setScope,
    downloadLocalBackup,
    handleImportFile,
    handleClearLocalData,
    loadBranches,
    checkBranch,
  }
}
