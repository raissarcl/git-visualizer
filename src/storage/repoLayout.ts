/**
 * Organização de repos na sidebar (`localStorage` key: `gh_repo_layout`).
 */

const LAYOUT_KEY = 'gh_repo_layout'

export interface RepoFolder {
  id: string
  name: string
  /** null = raiz */
  parentId: string | null
  collapsed?: boolean
}

export interface RepoLayout {
  folders: RepoFolder[]
  /** repo full name → pastas (várias permitidas); ausente/[] = sem pasta */
  foldersByRepo: Record<string, string[]>
  /** repos hidden from sidebar */
  hidden: string[]
  /** folderId → repos nesta pasta, na ordem da UI; ausente = fallback alfabético */
  repoOrderByFolder: Record<string, string[]>
  /** ordem dos repos sem pasta */
  uncategorizedOrder: string[]
}

export function emptyLayout(): RepoLayout {
  return {
    folders: [],
    foldersByRepo: {},
    hidden: [],
    repoOrderByFolder: {},
    uncategorizedOrder: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizeStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.filter((item): item is string => typeof item === 'string')
}

function normalizeFolders(raw: unknown): RepoFolder[] {
  if (!Array.isArray(raw)) return []

  return raw
    .filter((item): item is Record<string, unknown> => isRecord(item))
    .filter(
      (item) => typeof item.id === 'string' && typeof item.name === 'string',
    )
    .map((item) => ({
      id: item.id as string,
      name: item.name as string,
      parentId: typeof item.parentId === 'string' ? item.parentId : null,
      collapsed: Boolean(item.collapsed),
    }))
}

function migrateFoldersByRepo(
  raw: Record<string, unknown>,
): Record<string, string[]> {
  if (isRecord(raw.foldersByRepo) && !Array.isArray(raw.foldersByRepo)) {
    const out: Record<string, string[]> = {}

    for (const [repo, value] of Object.entries(raw.foldersByRepo)) {
      if (!Array.isArray(value)) continue
      const ids = value.filter(
        (id): id is string => typeof id === 'string' && id.length > 0,
      )
      if (ids.length > 0) out[repo] = [...new Set(ids)]
    }

    return out
  }

  if (isRecord(raw.folderByRepo) && !Array.isArray(raw.folderByRepo)) {
    const out: Record<string, string[]> = {}

    for (const [repo, value] of Object.entries(raw.folderByRepo)) {
      if (typeof value === 'string' && value.length > 0) out[repo] = [value]
    }

    return out
  }

  return {}
}

function normalizeRepoOrderByFolder(
  raw: unknown,
  folderIds: Set<string>,
): Record<string, string[]> {
  if (!isRecord(raw) || Array.isArray(raw)) return {}

  const out: Record<string, string[]> = {}
  for (const [folderId, value] of Object.entries(raw)) {
    if (!folderIds.has(folderId)) continue
    const list = normalizeStringList(value)
    if (list.length > 0) out[folderId] = [...new Set(list)]
  }
  return out
}

/** Normaliza layout salvo/legado (folderByRepo → foldersByRepo, parentId). */
export function normalizeLayout(raw: unknown): RepoLayout {
  if (!isRecord(raw)) return emptyLayout()

  const folders = normalizeFolders(raw.folders)
  const folderIds = new Set(folders.map((f) => f.id))

  for (const folder of folders) {
    if (folder.parentId && !folderIds.has(folder.parentId)) {
      folder.parentId = null
    }
    if (folder.parentId === folder.id) {
      folder.parentId = null
    }
  }

  const foldersByRepo = migrateFoldersByRepo(raw)
  for (const repo of Object.keys(foldersByRepo)) {
    foldersByRepo[repo] = foldersByRepo[repo].filter((id) => folderIds.has(id))
    if (foldersByRepo[repo].length === 0) delete foldersByRepo[repo]
  }

  return {
    folders,
    foldersByRepo,
    hidden: Array.isArray(raw.hidden)
      ? raw.hidden.filter((h): h is string => typeof h === 'string')
      : [],
    repoOrderByFolder: normalizeRepoOrderByFolder(
      raw.repoOrderByFolder,
      folderIds,
    ),
    uncategorizedOrder: [
      ...new Set(normalizeStringList(raw.uncategorizedOrder)),
    ],
  }
}

export function loadRepoLayout(): RepoLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (!raw) return emptyLayout()
    return normalizeLayout(JSON.parse(raw) as unknown)
  } catch {
    return emptyLayout()
  }
}

export function saveRepoLayout(layout: RepoLayout): void {
  localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout))
}

function newId(): string {
  return `folder_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

export function isRepoHidden(layout: RepoLayout, repo: string): boolean {
  return layout.hidden.includes(repo)
}

export function setRepoHidden(
  layout: RepoLayout,
  repo: string,
  hidden: boolean,
): RepoLayout {
  const set = new Set(layout.hidden)
  if (hidden) set.add(repo)
  else set.delete(repo)
  return { ...layout, hidden: [...set] }
}

export function folderIdsForRepo(layout: RepoLayout, repo: string): string[] {
  return layout.foldersByRepo[repo] ?? []
}

export function isRepoInFolder(
  layout: RepoLayout,
  repo: string,
  folderId: string,
): boolean {
  return folderIdsForRepo(layout, repo).includes(folderId)
}

export function isRepoUncategorized(layout: RepoLayout, repo: string): boolean {
  return folderIdsForRepo(layout, repo).length === 0
}

export function createFolder(
  layout: RepoLayout,
  name: string,
  parentId: string | null = null,
): RepoLayout {
  const trimmed = name.trim()
  if (!trimmed) return layout

  const parent =
    parentId && layout.folders.some((f) => f.id === parentId) ? parentId : null

  return {
    ...layout,
    folders: [
      ...layout.folders,
      { id: newId(), name: trimmed, parentId: parent, collapsed: false },
    ],
  }
}

export function renameFolder(
  layout: RepoLayout,
  folderId: string,
  name: string,
): RepoLayout {
  const trimmed = name.trim()
  if (!trimmed) return layout
  return {
    ...layout,
    folders: layout.folders.map((f) =>
      f.id === folderId ? { ...f, name: trimmed } : f,
    ),
  }
}

/** Ids da pasta e de toda a subárvore. */
export function collectSubtreeIds(
  layout: RepoLayout,
  folderId: string,
): Set<string> {
  const ids = new Set<string>([folderId])
  let grew = true

  while (grew) {
    grew = false
    for (const folder of layout.folders) {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id)
        grew = true
      }
    }
  }

  return ids
}

export function deleteFolder(layout: RepoLayout, folderId: string): RepoLayout {
  const removeIds = collectSubtreeIds(layout, folderId)
  const foldersByRepo: Record<string, string[]> = {}

  for (const [repo, ids] of Object.entries(layout.foldersByRepo)) {
    const next = ids.filter((id) => !removeIds.has(id))
    if (next.length > 0) foldersByRepo[repo] = next
  }

  const repoOrderByFolder = { ...layout.repoOrderByFolder }
  for (const id of removeIds) {
    delete repoOrderByFolder[id]
  }

  return {
    ...layout,
    folders: layout.folders.filter((f) => !removeIds.has(f.id)),
    foldersByRepo,
    repoOrderByFolder,
  }
}

/**
 * Move pasta para novo pai e índice entre irmãos.
 * `index` é a posição final entre irmãos (após remoção da origem).
 * Rejeita ciclos (novo pai na própria subárvore).
 */
export function moveFolder(
  layout: RepoLayout,
  folderId: string,
  newParentId: string | null,
  index: number,
): RepoLayout {
  const folder = layout.folders.find((f) => f.id === folderId)
  if (!folder) return layout

  if (newParentId !== null) {
    if (!layout.folders.some((f) => f.id === newParentId)) return layout
    if (collectSubtreeIds(layout, folderId).has(newParentId)) return layout
  }

  const siblings = layout.folders.filter(
    (f) => f.parentId === newParentId && f.id !== folderId,
  )
  const clamped = Math.max(0, Math.min(Math.floor(index), siblings.length))

  const without = layout.folders.filter((f) => f.id !== folderId)
  const moved: RepoFolder = { ...folder, parentId: newParentId }

  let insertAt: number
  if (clamped === 0) {
    const firstSiblingIdx = without.findIndex((f) => f.parentId === newParentId)
    insertAt = firstSiblingIdx === -1 ? without.length : firstSiblingIdx
  } else {
    const siblingBefore = siblings[clamped - 1]
    const idx = without.findIndex((f) => f.id === siblingBefore.id)
    insertAt = idx + 1
  }

  return {
    ...layout,
    folders: [...without.slice(0, insertAt), moved, ...without.slice(insertAt)],
  }
}

function appendToOrder(order: string[], repo: string): string[] {
  if (order.includes(repo)) return order
  return [...order, repo]
}

function removeFromOrder(order: string[], repo: string): string[] {
  return order.filter((r) => r !== repo)
}

function insertAtOrder(order: string[], repo: string, index: number): string[] {
  const next = order.filter((r) => r !== repo)
  const clamped = Math.max(0, Math.min(Math.floor(index), next.length))
  next.splice(clamped, 0, repo)
  return next
}

export function addRepoToFolder(
  layout: RepoLayout,
  repo: string,
  folderId: string,
): RepoLayout {
  if (!layout.folders.some((f) => f.id === folderId)) return layout

  const current = folderIdsForRepo(layout, repo)
  if (current.includes(folderId)) return layout

  const existingOrder = layout.repoOrderByFolder[folderId] ?? []

  return {
    ...layout,
    foldersByRepo: { ...layout.foldersByRepo, [repo]: [...current, folderId] },
    repoOrderByFolder: {
      ...layout.repoOrderByFolder,
      [folderId]: appendToOrder(existingOrder, repo),
    },
    uncategorizedOrder: removeFromOrder(layout.uncategorizedOrder, repo),
  }
}

export function removeRepoFromFolder(
  layout: RepoLayout,
  repo: string,
  folderId: string,
): RepoLayout {
  const current = folderIdsForRepo(layout, repo)
  if (!current.includes(folderId)) return layout

  const next = current.filter((id) => id !== folderId)
  const foldersByRepo = { ...layout.foldersByRepo }

  if (next.length === 0) delete foldersByRepo[repo]
  else foldersByRepo[repo] = next

  const repoOrderByFolder = { ...layout.repoOrderByFolder }
  const order = removeFromOrder(repoOrderByFolder[folderId] ?? [], repo)
  if (order.length === 0) delete repoOrderByFolder[folderId]
  else repoOrderByFolder[folderId] = order

  let uncategorizedOrder = layout.uncategorizedOrder
  if (next.length === 0) {
    uncategorizedOrder = appendToOrder(uncategorizedOrder, repo)
  }

  return { ...layout, foldersByRepo, repoOrderByFolder, uncategorizedOrder }
}

export function addReposToFolder(
  layout: RepoLayout,
  repos: string[],
  folderId: string,
): RepoLayout {
  let next = layout
  for (const repo of repos) {
    next = addRepoToFolder(next, repo, folderId)
  }
  return next
}

export function removeReposFromFolder(
  layout: RepoLayout,
  repos: string[],
  folderId: string,
): RepoLayout {
  let next = layout
  for (const repo of repos) {
    next = removeRepoFromFolder(next, repo, folderId)
  }
  return next
}

/** Define a ordem explícita dos repos numa pasta (`null` = sem pasta). */
export function reorderReposInFolder(
  layout: RepoLayout,
  folderId: string | null,
  orderedRepos: string[],
): RepoLayout {
  const unique = [...new Set(orderedRepos)]
  if (folderId === null) {
    return { ...layout, uncategorizedOrder: unique }
  }
  if (!layout.folders.some((f) => f.id === folderId)) return layout
  return {
    ...layout,
    repoOrderByFolder: {
      ...layout.repoOrderByFolder,
      [folderId]: unique,
    },
  }
}

/**
 * Move repo entre pastas (ou sem pasta).
 * `fromFolderId`/`toFolderId` null = uncategorized.
 * Multi-membership: remove só da origem; se destino já contém, só reordena.
 */
export function moveRepo(
  layout: RepoLayout,
  repo: string,
  fromFolderId: string | null,
  toFolderId: string | null,
  index: number,
): RepoLayout {
  if (fromFolderId === toFolderId) {
    if (fromFolderId === null) {
      return reorderReposInFolder(
        layout,
        null,
        insertAtOrder(layout.uncategorizedOrder, repo, index),
      )
    }
    const current = layout.repoOrderByFolder[fromFolderId] ?? []
    return reorderReposInFolder(
      layout,
      fromFolderId,
      insertAtOrder(current, repo, index),
    )
  }

  let next = layout

  if (fromFolderId === null) {
    next = {
      ...next,
      uncategorizedOrder: removeFromOrder(next.uncategorizedOrder, repo),
    }
  } else {
    next = removeRepoFromFolder(next, repo, fromFolderId)
    // removeRepoFromFolder may have appended to uncategorizedOrder; clear if moving elsewhere
    if (toFolderId !== null) {
      next = {
        ...next,
        uncategorizedOrder: removeFromOrder(next.uncategorizedOrder, repo),
      }
    }
  }

  if (toFolderId === null) {
    // Strip all remaining memberships so the repo is truly uncategorized
    for (const id of folderIdsForRepo(next, repo)) {
      next = removeRepoFromFolder(next, repo, id)
    }
    return {
      ...next,
      uncategorizedOrder: insertAtOrder(next.uncategorizedOrder, repo, index),
    }
  }

  next = addRepoToFolder(next, repo, toFolderId)
  const order = next.repoOrderByFolder[toFolderId] ?? []
  return reorderReposInFolder(
    next,
    toFolderId,
    insertAtOrder(order, repo, index),
  )
}

/**
 * Repos visíveis na pasta e em toda a subárvore (subpastas).
 * Associação direta (`isRepoInFolder`) continua valendo no organizer/sidebar.
 */
export function reposInFolder(
  layout: RepoLayout,
  folderId: string,
  allRepos: string[],
): string[] {
  const subtree = collectSubtreeIds(layout, folderId)
  return allRepos.filter((r) => {
    if (isRepoHidden(layout, r)) return false
    return folderIdsForRepo(layout, r).some((id) => subtree.has(id))
  })
}

export type SidebarScope =
  | { type: 'network' }
  | { type: 'repo'; name: string }
  | { type: 'folder'; id: string }

/**
 * Repos do escopo atual.
 * Em `network`, `networkFallback: 'all'` devolve todos; `'empty'` devolve [].
 */
export function reposForScope(
  scope: SidebarScope,
  layout: RepoLayout,
  allRepos: string[],
  networkFallback: 'empty' | 'all' = 'empty',
): string[] {
  if (scope.type === 'repo') return [scope.name]
  if (scope.type === 'folder') return reposInFolder(layout, scope.id, allRepos)
  return networkFallback === 'all' ? allRepos : []
}

export function toggleFolderCollapsed(
  layout: RepoLayout,
  folderId: string,
): RepoLayout {
  return {
    ...layout,
    folders: layout.folders.map((f) =>
      f.id === folderId ? { ...f, collapsed: !f.collapsed } : f,
    ),
  }
}

export interface FolderTreeNode {
  folder: RepoFolder
  children: FolderTreeNode[]
  repos: string[]
}

export interface SidebarTree {
  roots: FolderTreeNode[]
  uncategorized: string[]
}

function childFolders(
  layout: RepoLayout,
  parentId: string | null,
): RepoFolder[] {
  return layout.folders.filter((f) => f.parentId === parentId)
}

/** Aplica ordem salva; repos sem entrada caem no fim, alfabéticos entre si. */
export function applyRepoOrder(repos: string[], order: string[]): string[] {
  const pending = new Set(repos)
  const ordered: string[] = []

  for (const repo of order) {
    if (pending.has(repo)) {
      ordered.push(repo)
      pending.delete(repo)
    }
  }

  const rest = [...pending].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  )
  return [...ordered, ...rest]
}

function buildNode(
  layout: RepoLayout,
  folder: RepoFolder,
  visible: string[],
): FolderTreeNode {
  const members = visible.filter((r) => isRepoInFolder(layout, r, folder.id))
  return {
    folder,
    children: childFolders(layout, folder.id).map((child) =>
      buildNode(layout, child, visible),
    ),
    repos: applyRepoOrder(members, layout.repoOrderByFolder[folder.id] ?? []),
  }
}

/** Árvore de pastas + repos sem pasta (visível). */
export function buildSidebarTree(
  repos: string[],
  layout: RepoLayout,
): SidebarTree {
  const visible = repos.filter((r) => !isRepoHidden(layout, r))
  const uncategorized = visible.filter((r) => isRepoUncategorized(layout, r))

  return {
    roots: childFolders(layout, null).map((folder) =>
      buildNode(layout, folder, visible),
    ),
    uncategorized: applyRepoOrder(uncategorized, layout.uncategorizedOrder),
  }
}

export function layoutsEqual(a: RepoLayout, b: RepoLayout): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function cloneLayout(layout: RepoLayout): RepoLayout {
  return structuredClone(layout)
}
