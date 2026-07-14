/**
 * Dados locais do visualizador: notes, pins, layout, sidebar, backup.
 */

import { useCallback, useState } from 'react'
import {
  applyImportedData,
  downloadLocalBackup,
  parseBackupJson,
} from '../storage/backup'
import { loadNotes, saveNotes, setNote, type PrNotesMap } from '../storage/notes'
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

function clampScope(scope: SidebarScope, layout: RepoLayout): SidebarScope {
  if (scope.type === 'repo' && isRepoHidden(layout, scope.name)) {
    return { type: 'network' }
  }

  if (scope.type === 'folder' && !layout.folders.some((f) => f.id === scope.id)) {
    return { type: 'network' }
  }

  return scope
}

export function useLocalWorkspace() {
  const [layout, setLayout] = useState<RepoLayout>(() => loadRepoLayout())
  const [organizerOpen, setOrganizerOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(loadSidebarCollapsed)

  const [notes, setNotes] = useState<PrNotesMap>(() => loadNotes())
  const [pins, setPins] = useState<PinSet>(() => loadPins())
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
    setScope((current) => clampScope(current, data.repoLayout))
  }, [])

  const selectScope = useCallback((next: SidebarScope) => {
    setScope(next)
  }, [])

  return {
    layout,
    updateLayout,
    organizerOpen,
    setOrganizerOpen,
    sidebarCollapsed,
    toggleSidebar,
    notes,
    pins,
    handleNoteChange,
    handleTogglePin,
    scope,
    selectScope,
    setScope,
    downloadLocalBackup,
    handleImportFile,
  }
}
