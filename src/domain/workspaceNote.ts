/**
 * Notas de workspace (scratch) — entidades próprias, sem React ou I/O.
 */

export type NoteRemoteStatus = 'manual' | 'verified' | 'missing'

export type NoteLink =
  | { type: 'none' }
  | { type: 'repo'; repo: string }
  | {
      type: 'branch'
      repo: string
      branch: string
      remoteStatus: NoteRemoteStatus
      lastCheckedAt?: string
    }

export type NoteStatus = 'open' | 'archived'

export interface WorkspaceNote {
  id: string
  title: string
  body: string
  status: NoteStatus
  pinned: boolean
  tags: string[]
  createdAt: string
  updatedAt: string
  link: NoteLink
  linkedPr?: { repo: string; number: number } | null
}

export type NoteLinkFilter = 'all' | 'none' | 'repo' | 'branch'

export interface LocalWorkspaceNoteFilters {
  query: string
  status: 'all' | NoteStatus
  pinnedOnly: boolean
  tag: string
  linkType: NoteLinkFilter
  /** Só branches com remoteStatus !== verified */
  unverifiedOnly: boolean
  /** Em escopo repo/pasta, esconde notas gerais */
  excludeGeneral: boolean
}

export type NotesScopeFilter =
  | { type: 'network' }
  | { type: 'repos'; repos: string[]; excludeGeneral: boolean }

export function createWorkspaceNote(partial?: Partial<WorkspaceNote>): WorkspaceNote {
  const now = new Date().toISOString()
  return {
    id: partial?.id ?? crypto.randomUUID(),
    title: partial?.title ?? '',
    body: partial?.body ?? '',
    status: partial?.status ?? 'open',
    pinned: partial?.pinned ?? false,
    tags: partial?.tags ?? [],
    createdAt: partial?.createdAt ?? now,
    updatedAt: partial?.updatedAt ?? now,
    link: partial?.link ?? { type: 'none' },
    linkedPr: partial?.linkedPr ?? null,
  }
}

export function noteLinkRepo(link: NoteLink): string | null {
  if (link.type === 'none') return null
  return link.repo
}

export function remoteStatusLabel(status: NoteRemoteStatus): string {
  if (status === 'verified') return 'no remoto'
  if (status === 'missing') return 'não encontrada'
  return 'não verificada'
}

export function linkBadgeLabel(link: NoteLink): string {
  if (link.type === 'none') return 'geral'
  if (link.type === 'repo') return link.repo
  return `${link.repo}@${link.branch}`
}

/** Pins primeiro; depois updatedAt desc. */
export function sortWorkspaceNotes(notes: WorkspaceNote[]): WorkspaceNote[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
}

function matchesScope(note: WorkspaceNote, scope: NotesScopeFilter): boolean {
  if (scope.type === 'network') return true

  const isGeneral = note.link.type === 'none'
  if (isGeneral) return !scope.excludeGeneral

  const repo = noteLinkRepo(note.link)
  return Boolean(repo && scope.repos.includes(repo))
}

export function filterWorkspaceNotes(
  notes: WorkspaceNote[],
  filters: LocalWorkspaceNoteFilters,
  scope: NotesScopeFilter,
): WorkspaceNote[] {
  const q = filters.query.trim().toLowerCase()
  const tag = filters.tag.trim().toLowerCase()

  const scoped: NotesScopeFilter =
    scope.type === 'repos'
      ? { type: 'repos', repos: scope.repos, excludeGeneral: filters.excludeGeneral }
      : scope

  let result = notes.filter((note) => matchesScope(note, scoped))

  if (filters.status !== 'all') {
    result = result.filter((n) => n.status === filters.status)
  }

  if (filters.pinnedOnly) {
    result = result.filter((n) => n.pinned)
  }

  if (filters.linkType !== 'all') {
    result = result.filter((n) => n.link.type === filters.linkType)
  }

  if (filters.unverifiedOnly) {
    result = result.filter(
      (n) => n.link.type === 'branch' && n.link.remoteStatus !== 'verified',
    )
  }

  if (tag) {
    result = result.filter((n) => n.tags.some((t) => t.toLowerCase() === tag))
  }

  if (q) {
    result = result.filter((n) => {
      const linkText = linkBadgeLabel(n.link).toLowerCase()
      const tagsText = n.tags.join(' ').toLowerCase()
      return (
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        linkText.includes(q) ||
        tagsText.includes(q)
      )
    })
  }

  return sortWorkspaceNotes(result)
}

/** PR aberto cuja head bate com a branch da nota. */
export function findMatchingPr(
  note: WorkspaceNote,
  prs: { repo: string; number: number; headRefName: string; state: string }[],
): { repo: string; number: number } | null {
  if (note.link.type !== 'branch') return null
  const { repo, branch } = note.link
  const hit = prs.find(
    (pr) =>
      pr.repo === repo &&
      pr.headRefName === branch &&
      pr.state === 'OPEN',
  )
  return hit ? { repo: hit.repo, number: hit.number } : null
}

export function normalizeTags(raw: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const t of raw) {
    const trimmed = t.trim()
    if (!trimmed) continue
    const key = trimmed.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(trimmed)
  }
  return out
}

/** Texto plano do body para preview (markdown leve). */
export function noteBodyPreview(note: Pick<WorkspaceNote, 'body'>, maxLen = 80): string {
  const flat = note.body
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!flat) return ''
  if (flat.length <= maxLen) return flat
  return `${flat.slice(0, Math.max(1, maxLen - 1)).trimEnd()}…`
}

/** Título na lista: title, senão trecho do body, senão placeholder. */
export function noteListTitle(note: Pick<WorkspaceNote, 'title' | 'body'>): string {
  const title = note.title.trim()
  if (title) return title
  const preview = noteBodyPreview(note, 80)
  return preview || '(sem título)'
}

/** Compara conteúdo editável (ignora updatedAt). */
export function workspaceNotesContentEqual(a: WorkspaceNote, b: WorkspaceNote): boolean {
  return (
    a.id === b.id &&
    a.title === b.title &&
    a.body === b.body &&
    a.status === b.status &&
    a.pinned === b.pinned &&
    a.createdAt === b.createdAt &&
    JSON.stringify(a.tags) === JSON.stringify(b.tags) &&
    JSON.stringify(a.link) === JSON.stringify(b.link) &&
    JSON.stringify(a.linkedPr ?? null) === JSON.stringify(b.linkedPr ?? null)
  )
}
