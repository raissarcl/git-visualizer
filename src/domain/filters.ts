import type { PullRequest } from './pullRequest'
import { prKey } from './prKey'

/** Mapa local de notas por chave de PR. */
export type PrNotesMap = Record<string, string>

/** Conjunto de PRs fixados (keys). */
export type PinSet = Set<string>

export type AgeFilterDays = 0 | 3 | 7 | 14 | 30

/** Filtros aplicados no cliente após o fetch da API. */
export interface LocalFilters {
  query: string
  notesOnly: boolean
  conflictOnly: boolean
  /** 0 = desligado */
  minOpenDays: AgeFilterDays
}

function openAgeDays(pr: PullRequest, now: number): number {
  const created = new Date(pr.createdAt).getTime()
  if (Number.isNaN(created)) return 0
  return (now - created) / (1000 * 60 * 60 * 24)
}

function hasNoteText(notes: PrNotesMap, key: string): boolean {
  return Boolean(notes[key]?.trim())
}

/** Busca textual local — estado/repo/mineOnly vão para a API. */
export function filterByQuery(prs: PullRequest[], query: string): PullRequest[] {
  const q = query.trim().toLowerCase()
  if (!q) return prs

  return prs.filter(
    (pr) =>
      pr.title.toLowerCase().includes(q) ||
      pr.repo.toLowerCase().includes(q) ||
      pr.headRefName.toLowerCase().includes(q) ||
      pr.baseRefName.toLowerCase().includes(q) ||
      pr.authorLogin.toLowerCase().includes(q) ||
      pr.body.toLowerCase().includes(q) ||
      String(pr.number).includes(q),
  )
}

/**
 * Pipeline de filtros locais (texto, notas, conflito, idade de PRs open).
 */
export function filterPullRequests(
  prs: PullRequest[],
  filters: LocalFilters,
  notes: PrNotesMap,
): PullRequest[] {
  const now = Date.now()
  let result = filterByQuery(prs, filters.query)

  if (filters.notesOnly) {
    result = result.filter((pr) => hasNoteText(notes, prKey(pr.repo, pr.number)))
  }

  if (filters.conflictOnly) {
    result = result.filter((pr) => pr.mergeable === 'CONFLICTING')
  }

  if (filters.minOpenDays > 0) {
    const min = filters.minOpenDays
    result = result.filter((pr) => pr.state === 'OPEN' && openAgeDays(pr, now) >= min)
  }

  return result
}

/** Fixados primeiro; ordem relativa dentro de cada grupo preservada. */
export function sortPinnedFirst(prs: PullRequest[], pins: PinSet): PullRequest[] {
  if (pins.size === 0) return prs
  const pinned: PullRequest[] = []
  const rest: PullRequest[] = []
  for (const pr of prs) {
    if (pins.has(prKey(pr.repo, pr.number))) pinned.push(pr)
    else rest.push(pr)
  }
  return [...pinned, ...rest]
}
