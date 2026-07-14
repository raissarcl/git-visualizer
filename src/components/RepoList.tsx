import {
  buildSidebarSections,
  type RepoLayout,
  type SidebarScope,
} from '../storage/repoLayout'

interface RepoListProps {
  repos: string[]
  layout: RepoLayout
  scope: SidebarScope
  onSelectScope: (scope: SidebarScope) => void
  onToggleFolder: (folderId: string) => void
  onOrganize: () => void
  loadedCount: number
}

function isRepoActive(scope: SidebarScope, name: string): boolean {
  return scope.type === 'repo' && scope.name === name
}

function isFolderActive(scope: SidebarScope, id: string): boolean {
  return scope.type === 'folder' && scope.id === id
}

export function RepoList({
  repos,
  layout,
  scope,
  onSelectScope,
  onToggleFolder,
  onOrganize,
  loadedCount,
}: RepoListProps) {
  const sections = buildSidebarSections(repos, layout)
  const networkActive = scope.type === 'network'

  return (
    <div className="repo-list">
      <div className="repo-list-header">
        <h2 className="sidebar-heading">Repositórios</h2>
        <button type="button" className="btn-organize" onClick={onOrganize}>
          Organizar
        </button>
      </div>
      <ul className="repo-list-items scrollable">
        <li>
          <button
            type="button"
            className={`repo-item${networkActive ? ' is-active' : ''}`}
            onClick={() => onSelectScope({ type: 'network' })}
          >
            <span className="repo-item-name">Sua rede</span>
            <span className="repo-item-count">{networkActive ? loadedCount : '—'}</span>
          </button>
        </li>

        {sections.map((section) => {
          if (section.folder) {
            const folder = section.folder
            const collapsed = Boolean(folder.collapsed)
            const folderActive = isFolderActive(scope, folder.id)
            return (
              <li key={folder.id} className="repo-folder-block">
                <div className={`repo-folder-header-row${folderActive ? ' is-active' : ''}`}>
                  <button
                    type="button"
                    className="repo-folder-chevron-btn"
                    onClick={() => onToggleFolder(folder.id)}
                    aria-expanded={!collapsed}
                    title={collapsed ? 'Expandir' : 'Recolher'}
                  >
                    {collapsed ? '▸' : '▾'}
                  </button>
                  <button
                    type="button"
                    className="repo-folder-select"
                    onClick={() => onSelectScope({ type: 'folder', id: folder.id })}
                    title={`Ver PRs de ${folder.name}`}
                  >
                    <span className="repo-folder-label">{folder.name}</span>
                    <span className="repo-item-count">
                      {folderActive ? loadedCount : section.repos.length}
                    </span>
                  </button>
                </div>
                {!collapsed && (
                  <ul className="repo-folder-items">
                    {section.repos.length === 0 ? (
                      <li className="repo-folder-empty">Vazia</li>
                    ) : (
                      section.repos.map((name) => (
                        <li key={name}>
                          <button
                            type="button"
                            className={`repo-item repo-item-nested${isRepoActive(scope, name) ? ' is-active' : ''}`}
                            onClick={() => onSelectScope({ type: 'repo', name })}
                            title={name}
                          >
                            <span className="repo-item-name">{name}</span>
                            <span className="repo-item-count">
                              {isRepoActive(scope, name) ? loadedCount : '—'}
                            </span>
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </li>
            )
          }

          return section.repos.map((name) => (
            <li key={name}>
              <button
                type="button"
                className={`repo-item${isRepoActive(scope, name) ? ' is-active' : ''}`}
                onClick={() => onSelectScope({ type: 'repo', name })}
                title={name}
              >
                <span className="repo-item-name">{name}</span>
                <span className="repo-item-count">
                  {isRepoActive(scope, name) ? loadedCount : '—'}
                </span>
              </button>
            </li>
          ))
        })}
      </ul>
    </div>
  )
}
