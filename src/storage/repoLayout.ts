/**
 * Organização de repos na sidebar (`localStorage` key: `gh_repo_layout`).
 */

const LAYOUT_KEY = 'gh_repo_layout'

export interface RepoFolder {
  id: string
  name: string
  collapsed?: boolean
}

export interface RepoLayout {
  folders: RepoFolder[]
  /** repo full name -> folderId; missing/null = uncategorized */
  folderByRepo: Record<string, string | null>
  /** repos hidden from sidebar */
  hidden: string[]
}

export function emptyLayout(): RepoLayout {
  return { folders: [], folderByRepo: {}, hidden: [] }
}

export function loadRepoLayout(): RepoLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (!raw) return emptyLayout()
    const parsed = JSON.parse(raw) as Partial<RepoLayout>
    return {
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
      folderByRepo:
        parsed.folderByRepo && typeof parsed.folderByRepo === 'object'
          ? parsed.folderByRepo
          : {},
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
    }
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

export function setRepoHidden(layout: RepoLayout, repo: string, hidden: boolean): RepoLayout {
  const set = new Set(layout.hidden)
  if (hidden) set.add(repo)
  else set.delete(repo)
  return { ...layout, hidden: [...set] }
}

export function createFolder(layout: RepoLayout, name: string): RepoLayout {
  const trimmed = name.trim()
  if (!trimmed) return layout
  return {
    ...layout,
    folders: [...layout.folders, { id: newId(), name: trimmed, collapsed: false }],
  }
}

export function renameFolder(layout: RepoLayout, folderId: string, name: string): RepoLayout {
  const trimmed = name.trim()
  if (!trimmed) return layout
  return {
    ...layout,
    folders: layout.folders.map((f) => (f.id === folderId ? { ...f, name: trimmed } : f)),
  }
}

export function deleteFolder(layout: RepoLayout, folderId: string): RepoLayout {
  const folderByRepo = { ...layout.folderByRepo }
  for (const [repo, fid] of Object.entries(folderByRepo)) {
    if (fid === folderId) folderByRepo[repo] = null
  }
  return {
    ...layout,
    folders: layout.folders.filter((f) => f.id !== folderId),
    folderByRepo,
  }
}

export function assignRepoFolder(
  layout: RepoLayout,
  repo: string,
  folderId: string | null,
): RepoLayout {
  return {
    ...layout,
    folderByRepo: { ...layout.folderByRepo, [repo]: folderId },
  }
}

export function assignReposFolder(
  layout: RepoLayout,
  repos: string[],
  folderId: string | null,
): RepoLayout {
  const folderByRepo = { ...layout.folderByRepo }
  for (const repo of repos) {
    folderByRepo[repo] = folderId
  }
  return { ...layout, folderByRepo }
}

export function reposInFolder(
  layout: RepoLayout,
  folderId: string,
  allRepos: string[],
): string[] {
  return allRepos.filter(
    (r) => !isRepoHidden(layout, r) && layout.folderByRepo[r] === folderId,
  )
}

export type SidebarScope =
  | { type: 'network' }
  | { type: 'repo'; name: string }
  | { type: 'folder'; id: string }

export function toggleFolderCollapsed(layout: RepoLayout, folderId: string): RepoLayout {
  return {
    ...layout,
    folders: layout.folders.map((f) =>
      f.id === folderId ? { ...f, collapsed: !f.collapsed } : f,
    ),
  }
}

export interface SidebarSection {
  folder: RepoFolder | null
  repos: string[]
}

/** Repos visíveis: pastas na ordem, depois sem pasta. */
export function buildSidebarSections(repos: string[], layout: RepoLayout): SidebarSection[] {
  const visible = repos.filter((r) => !isRepoHidden(layout, r))
  const inFolder = new Set<string>()
  const sections: SidebarSection[] = []

  for (const folder of layout.folders) {
    const folderRepos = visible.filter((r) => layout.folderByRepo[r] === folder.id)
    for (const r of folderRepos) inFolder.add(r)
    sections.push({ folder, repos: folderRepos })
  }

  const uncategorized = visible.filter((r) => !inFolder.has(r))
  sections.push({ folder: null, repos: uncategorized })
  return sections
}
