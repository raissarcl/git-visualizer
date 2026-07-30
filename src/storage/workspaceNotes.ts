/**
 * Persistência das notas de workspace (`localStorage`).
 * Nunca sincroniza com o GitHub.
 */

import type { NoteLink, NoteRemoteStatus, WorkspaceNote } from '../domain/workspaceNote'
import { normalizeTags } from '../domain/workspaceNote'

const WORKSPACE_NOTES_KEY = 'pr-network-workspace-notes'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseRemoteStatus(raw: unknown): NoteRemoteStatus {
  if (raw === 'verified' || raw === 'missing' || raw === 'manual') return raw
  return 'manual'
}

function parseLink(raw: unknown): NoteLink {
  if (!isRecord(raw) || typeof raw.type !== 'string') return { type: 'none' }
  if (raw.type === 'none') return { type: 'none' }
  if (raw.type === 'repo' && typeof raw.repo === 'string' && raw.repo.trim()) {
    return { type: 'repo', repo: raw.repo.trim() }
  }
  if (
    raw.type === 'branch' &&
    typeof raw.repo === 'string' &&
    raw.repo.trim() &&
    typeof raw.branch === 'string' &&
    raw.branch.trim()
  ) {
    return {
      type: 'branch',
      repo: raw.repo.trim(),
      branch: raw.branch.trim(),
      remoteStatus: parseRemoteStatus(raw.remoteStatus),
      lastCheckedAt:
        typeof raw.lastCheckedAt === 'string' ? raw.lastCheckedAt : undefined,
    }
  }
  return { type: 'none' }
}

function parseLinkedPr(
  raw: unknown,
): { repo: string; number: number } | null {
  if (!isRecord(raw)) return null
  if (typeof raw.repo !== 'string' || !raw.repo.trim()) return null
  if (typeof raw.number !== 'number' || !Number.isFinite(raw.number)) return null
  return { repo: raw.repo.trim(), number: raw.number }
}

function parseOne(raw: unknown): WorkspaceNote | null {
  if (!isRecord(raw)) return null
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null

  const title = typeof raw.title === 'string' ? raw.title : ''
  const body = typeof raw.body === 'string' ? raw.body : ''
  const status = raw.status === 'archived' ? 'archived' : 'open'
  const pinned = raw.pinned === true
  const tags = Array.isArray(raw.tags)
    ? normalizeTags(raw.tags.filter((t): t is string => typeof t === 'string'))
    : []
  const createdAt =
    typeof raw.createdAt === 'string' && raw.createdAt
      ? raw.createdAt
      : new Date().toISOString()
  const updatedAt =
    typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : createdAt

  return {
    id: raw.id.trim(),
    title,
    body,
    status,
    pinned,
    tags,
    createdAt,
    updatedAt,
    link: parseLink(raw.link),
    linkedPr: parseLinkedPr(raw.linkedPr),
  }
}

export function parseWorkspaceNotes(raw: unknown): WorkspaceNote[] {
  if (!Array.isArray(raw)) return []
  const out: WorkspaceNote[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const note = parseOne(item)
    if (!note || seen.has(note.id)) continue
    seen.add(note.id)
    out.push(note)
  }
  return out
}

export function loadWorkspaceNotes(): WorkspaceNote[] {
  try {
    const raw = localStorage.getItem(WORKSPACE_NOTES_KEY)
    if (!raw) return []
    return parseWorkspaceNotes(JSON.parse(raw) as unknown)
  } catch {
    return []
  }
}

export function saveWorkspaceNotes(notes: WorkspaceNote[]): void {
  localStorage.setItem(WORKSPACE_NOTES_KEY, JSON.stringify(notes))
}

export function upsertWorkspaceNote(
  notes: WorkspaceNote[],
  note: WorkspaceNote,
): WorkspaceNote[] {
  const idx = notes.findIndex((n) => n.id === note.id)
  if (idx < 0) return [...notes, note]
  const next = [...notes]
  next[idx] = note
  return next
}

export function removeWorkspaceNote(notes: WorkspaceNote[], id: string): WorkspaceNote[] {
  return notes.filter((n) => n.id !== id)
}
