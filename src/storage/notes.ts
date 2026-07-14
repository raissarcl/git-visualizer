/**
 * Notas locais por PR (`localStorage` key: `pr-network-notes`).
 * Nunca sincroniza com o GitHub.
 */

import type { PrNotesMap } from '../domain/filters'

const NOTES_KEY = 'pr-network-notes'

export type { PrNotesMap }

export function loadNotes(): PrNotesMap {
  try {
    const raw = localStorage.getItem(NOTES_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: PrNotesMap = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.trim()) {
        out[key] = value
      }
    }
    return out
  } catch {
    return {}
  }
}

export function saveNotes(notes: PrNotesMap): void {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
}

export function hasNote(notes: PrNotesMap, key: string): boolean {
  return Boolean(notes[key]?.trim())
}

/** Retorna novo mapa; texto vazio remove a entrada. */
export function setNote(notes: PrNotesMap, key: string, text: string): PrNotesMap {
  const trimmed = text.trim()
  const next = { ...notes }
  if (trimmed) {
    next[key] = text
  } else {
    delete next[key]
  }
  return next
}
