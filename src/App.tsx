import { useMemo } from 'react'
import { TokenBar } from './components/TokenBar'
import { Filters } from './components/Filters'
import { PrDetail } from './components/PrDetail'
import { PrList } from './components/PrList'
import { RepoList } from './components/RepoList'
import { RepoOrganizer } from './components/RepoOrganizer'
import { prKey } from './domain/prKey'
import { useAuth } from './hooks/useAuth'
import { useLocalWorkspace } from './hooks/useLocalWorkspace'
import { usePrFilters } from './hooks/usePrFilters'
import { usePullRequests } from './hooks/usePullRequests'
import { isPinned } from './storage/pins'
import { reposInFolder, toggleFolderCollapsed } from './storage/repoLayout'
import './styles.css'

/**
 * Shell da aplicação: compõe hooks de auth, dados remotos, workspace local e UI.
 */
export default function App() {
  const auth = useAuth()
  const workspace = useLocalWorkspace()
  const filters = usePrFilters()

  const prData = usePullRequests({
    token: auth.token,
    mineOnly: filters.mineOnly,
    stateFilter: filters.stateFilter,
    scope: workspace.scope,
    layout: workspace.layout,
  })

  const filtered = useMemo(
    () => filters.applyFilters(prData.prs, workspace.notes, workspace.pins),
    [filters.applyFilters, prData.prs, workspace.notes, workspace.pins],
  )

  const selectedListId = prData.selectedPr
    ? prKey(prData.selectedPr.repo, prData.selectedPr.number)
    : null

  const folderScope = workspace.scope.type === 'folder' ? workspace.scope : null

  const folderName = folderScope
    ? workspace.layout.folders.find((f) => f.id === folderScope.id)?.name
    : null

  const scopeReposCount = folderScope
    ? reposInFolder(workspace.layout, folderScope.id, prData.viewerRepos).length
    : 0

  const handleSave = () => {
    const next = auth.save()

    if (!next) {
      prData.resetOnEmptyToken()
    }
  }

  const handleSelectScope = (next: Parameters<typeof workspace.selectScope>[0]) => {
    workspace.selectScope(next)
    prData.setSelectedPr(null)
  }

  return (
    <div className="app">
      <header className="top-bar">
        <div className="brand">
          <h1>PR Network</h1>
          <p>Rede de PRs e branches · GitHub</p>
        </div>
        <TokenBar
          tokenInput={auth.tokenInput}
          onTokenInputChange={auth.setTokenInput}
          onSave={handleSave}
          onRefresh={prData.refresh}
          onChangeToken={auth.startEditToken}
          onCancelEdit={auth.cancelEditToken}
          hasToken={auth.hasToken}
          editingToken={auth.editingToken}
          loading={prData.loading}
        />
        {prData.error && <div className="banner banner-error">{prData.error}</div>}
      </header>

      <div className={`app-shell${workspace.sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
        <aside className="sidebar" aria-hidden={workspace.sidebarCollapsed}>
          <div className="sidebar-body">
            <RepoList
              repos={prData.viewerRepos}
              layout={workspace.layout}
              scope={workspace.scope}
              onSelectScope={handleSelectScope}
              onToggleFolder={(id) =>
                workspace.updateLayout(toggleFolderCollapsed(workspace.layout, id))
              }
              onOrganize={() => workspace.setOrganizerOpen(true)}
              loadedCount={prData.prs.length}
            />
            <Filters
              mineOnly={filters.mineOnly}
              onMineOnlyChange={filters.setMineOnly}
              state={filters.stateFilter}
              onStateChange={filters.setStateFilter}
              query={filters.query}
              onQueryChange={filters.setQuery}
              notesOnly={filters.notesOnly}
              onNotesOnlyChange={filters.setNotesOnly}
              conflictOnly={filters.conflictOnly}
              onConflictOnlyChange={filters.setConflictOnly}
              minOpenDays={filters.minOpenDays}
              onMinOpenDaysChange={filters.setMinOpenDays}
              loaded={prData.prs.length}
              hasMore={prData.pageInfo.hasNextPage}
              onExport={workspace.downloadLocalBackup}
              onImportFile={workspace.handleImportFile}
            />
          </div>
        </aside>

        <section className="main-panel">
          <div className="main-toolbar">
            <button
              type="button"
              className="btn-sidebar-toggle"
              onClick={workspace.toggleSidebar}
              title={workspace.sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'}
              aria-label={
                workspace.sidebarCollapsed ? 'Expandir sidebar' : 'Colapsar sidebar'
              }
              aria-expanded={!workspace.sidebarCollapsed}
            >
              {workspace.sidebarCollapsed ? '⟩' : '⟨'}
            </button>
            {workspace.scope.type === 'repo' ? (
              <p className="main-scope">
                Repo: <code>{workspace.scope.name}</code>
                {!filters.mineOnly && ' · todos os autores'}
              </p>
            ) : workspace.scope.type === 'folder' ? (
              <p className="main-scope">
                Pasta: <strong>{folderName ?? '…'}</strong>
                {` · ${scopeReposCount} repo${scopeReposCount === 1 ? '' : 's'}`}
              </p>
            ) : (
              <p className="main-scope">
                Sua rede (involves você). Selecione um repo ou uma pasta.
              </p>
            )}
            {prData.loading && <p className="main-loading">Carregando…</p>}
          </div>

          <div className="main-content">
            {!auth.token && !prData.loading ? (
              <div className="graph-empty">
                <p>
                  Cole um Personal Access Token acima e clique em <strong>Salvar</strong> para
                  carregar PRs.
                </p>
              </div>
            ) : (
              <PrList
                prs={filtered}
                selectedId={selectedListId}
                notes={workspace.notes}
                pins={workspace.pins}
                onSelect={prData.setSelectedPr}
                hasMore={prData.pageInfo.hasNextPage}
                loadingMore={prData.loadingMore}
                onLoadMore={prData.loadMore}
              />
            )}
          </div>

          <PrDetail
            pr={prData.selectedPr}
            note={
              prData.selectedPr
                ? (workspace.notes[prKey(prData.selectedPr.repo, prData.selectedPr.number)] ??
                  '')
                : ''
            }
            pinned={
              prData.selectedPr
                ? isPinned(
                    workspace.pins,
                    prKey(prData.selectedPr.repo, prData.selectedPr.number),
                  )
                : false
            }
            onNoteChange={workspace.handleNoteChange}
            onTogglePin={workspace.handleTogglePin}
            onClose={() => prData.setSelectedPr(null)}
          />
        </section>
      </div>

      <RepoOrganizer
        open={workspace.organizerOpen}
        repos={prData.viewerRepos}
        layout={workspace.layout}
        onChange={workspace.updateLayout}
        onClose={() => workspace.setOrganizerOpen(false)}
      />
    </div>
  )
}
