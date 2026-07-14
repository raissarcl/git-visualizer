/**
 * Export/import JSON dos dados do visualizador (sem PAT).
 *
 * Formato versionado (`version: 1`): notes, pins, repoLayout, sidebarCollapsed.
 */

import type { PrNotesMap, PinSet } from '../domain/filters'
import { loadNotes, saveNotes } from './notes'
import { loadPins, savePins } from './pins'
import { SIDEBAR_COLLAPSED_KEY, saveSidebarCollapsed } from './preferences'
import {
  emptyLayout,
  loadRepoLayout,
  saveRepoLayout,
  type RepoLayout,
} from './repoLayout'

const BACKUP_VERSION = 1

export interface LocalBackupPayload {
  version: number
  exportedAt: string
  notes: PrNotesMap
  pins: string[]
  repoLayout: RepoLayout
  sidebarCollapsed: boolean
}

export interface ImportedLocalData {
  notes: PrNotesMap
  pins: PinSet
  repoLayout: RepoLayout
  sidebarCollapsed: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseNotes(raw: unknown): PrNotesMap {
  if (!isRecord(raw)) return {}
  const out: PrNotesMap = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'string' && value.trim()) out[key] = value
  }
  return out
}

function parsePins(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((k): k is string => typeof k === 'string' && k.length > 0)
}

function parseLayout(raw: unknown): RepoLayout {
  if (!isRecord(raw)) return emptyLayout()
  return {
    folders: Array.isArray(raw.folders) ? (raw.folders as RepoLayout['folders']) : [],
    folderByRepo:
      raw.folderByRepo && typeof raw.folderByRepo === 'object' && !Array.isArray(raw.folderByRepo)
        ? (raw.folderByRepo as RepoLayout['folderByRepo'])
        : {},
    hidden: Array.isArray(raw.hidden)
      ? raw.hidden.filter((h): h is string => typeof h === 'string')
      : [],
  }
}

export function buildLocalBackup(): LocalBackupPayload {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    notes: loadNotes(),
    pins: [...loadPins()],
    repoLayout: loadRepoLayout(),
    sidebarCollapsed: localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1',
  }
}

export function downloadLocalBackup(): void {
  const payload = buildLocalBackup()
  const date = payload.exportedAt.slice(0, 10)
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pr-network-backup-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Valida e interpreta um arquivo de backup.
 * @throws Error se JSON inválido ou versão incompatível
 */
export function parseBackupJson(text: string): ImportedLocalData {
  let parsed: unknown
  try {
    parsed = JSON.parse(text) as unknown
  } catch {
    throw new Error('Arquivo JSON inválido.')
  }

  if (!isRecord(parsed) || parsed.version !== BACKUP_VERSION) {
    throw new Error('Backup incompatível ou sem version: 1.')
  }

  return {
    notes: parseNotes(parsed.notes),
    pins: new Set(parsePins(parsed.pins)),
    repoLayout: parseLayout(parsed.repoLayout),
    sidebarCollapsed: parsed.sidebarCollapsed === true,
  }
}

/** Sobrescreve dados locais do visualizador (nunca toca o PAT). */
export function applyImportedData(data: ImportedLocalData): void {
  saveNotes(data.notes)
  savePins(data.pins)
  saveRepoLayout(data.repoLayout)
  saveSidebarCollapsed(data.sidebarCollapsed)
}
