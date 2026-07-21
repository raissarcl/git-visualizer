import { useMemo, useState } from 'react'
import { ActionDetail } from './components/ActionDetail'
import { ActionsList } from './components/ActionsList'
import { DispatchModal } from './components/DispatchModal'
import { Filters } from './components/Filters'
import { PrDetail } from './components/PrDetail'
import { PrList } from './components/PrList'
import { RepoList } from './components/RepoList'
import { RepoOrganizer } from './components/RepoOrganizer'
import { TokenBar } from './components/TokenBar'
import { ViewTabs, type AppView } from './components/ViewTabs'
import { prKey } from './domain/prKey'
import type { PeriodFilterDays } from './domain/filters'
import {
  actionNoteKey,
  filterWorkflowRuns,
  runKey,
  type ActionsStatusFilter,
} from './domain/workflowRun'
import { useActions } from './hooks/useActions'
import { useAuth } from './hooks/useAuth'
import { useLocalWorkspace } from './hooks/useLocalWorkspace'
import { usePrFilters } from './hooks/usePrFilters'
import { usePullRequests } from './hooks/usePullRequests'
import { useTheme } from './hooks/useTheme'
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
  const { theme, toggleTheme } = useTheme()
  const [view, setView] = useState<AppView>('prs')
  const [actionsQuery, setActionsQuery] = useState('')
  const [actionsStatus, setActionsStatus] = useState<ActionsStatusFilter>('all')
  const [actionsWithinDays, setActionsWithinDays] = useState<PeriodFilterDays>(0)
  const [actionsNotesOnly, setActionsNotesOnly] = useState(false)
  const [dispatchOpen, setDispatchOpen] = useState(false)

  const prData = usePullRequests({
    token: auth.token,
    mineOnly: filters.mineOnly,
    stateFilter: filters.stateFilter,
    scope: workspace.scope,
    layout: workspace.layout,
  })

  const actions = useActions({
    token: auth.token,
    scope: workspace.scope,
    layout: workspace.layout,
    viewerRepos: prData.viewerRepos,
    active: view === 'actions',
  })

  const filtered = useMemo(
    () => filters.applyFilters(prData.prs, workspace.notes, workspace.pins),
    [filters.applyFilters, prData.prs, workspace.notes, workspace.pins],
  )

  const filteredRuns = useMemo(
    () =>
      filterWorkflowRuns(actions.runs, {
        query: actionsQuery,
        status: actionsStatus,
        withinDays: actionsWithinDays,
        notesOnly: actionsNotesOnly,
        notes: workspace.notes,
      }),
    [
      actions.runs,
      actionsQuery,
      actionsStatus,
      actionsWithinDays,
      actionsNotesOnly,
      workspace.notes,
    ],
  )

  const selectedListId = prData.selectedPr
    ? prKey(prData.selectedPr.repo, prData.selectedPr.number)
    : null

  const selectedRunId = actions.selectedRun
    ? runKey(actions.selectedRun.repo, actions.selectedRun.id)
    : null

  const folderScope = workspace.scope.type === 'folder' ? workspace.scope : null

  const folderName = folderScope
    ? workspace.layout.folders.find((f) => f.id === folderScope.id)?.name
    : null

  const scopeReposCount = folderScope
    ? reposInFolder(workspace.layout, folderScope.id, prData.viewerRepos).length
    : 0

  const dispatchRepos = useMemo(() => {
    if (workspace.scope.type === 'repo') return [workspace.scope.name]
    if (workspace.scope.type === 'folder') {
      return reposInFolder(workspace.layout, workspace.scope.id, prData.viewerRepos)
    }
    return []
  }, [workspace.scope, workspace.layout, prData.viewerRepos])

  const dispatchInitialRepo =
    workspace.scope.type === 'repo'
      ? workspace.scope.name
      : (actions.selectedRun?.repo ?? dispatchRepos[0] ?? null)

  const headerError = view === 'actions' ? actions.error : prData.error
  const loading = view === 'actions' ? actions.loading : prData.loading

  const handleSave = () => {
    const next = auth.save()

    if (!next) {
      prData.resetOnEmptyToken()
      actions.resetOnEmptyToken()
    }
  }

  const handleClearToken = () => {
    auth.clearToken()
    prData.resetOnEmptyToken()
    actions.resetOnEmptyToken()
  }

  const handleSelectScope = (next: Parameters<typeof workspace.selectScope>[0]) => {
    workspace.selectScope(next)
    prData.setSelectedPr(null)
    actions.selectRun(null)
  }

  const handleRefresh = () => {
    if (view === 'actions') actions.refresh()
    else prData.refresh()
  }

  const actionsNetworkHint = view === 'actions' && workspace.scope.type === 'network'

  return (
    <div className="app">
      <header className="top-bar">
        <div className="brand">
          <h1>PR Network</h1>
          <p>Rede de PRs, branches e Actions · GitHub</p>
        </div>
        <TokenBar
          tokenInput={auth.tokenInput}
          onTokenInputChange={auth.setTokenInput}
          onSave={handleSave}
          onRefresh={handleRefresh}
          onClearToken={handleClearToken}
          hasToken={auth.hasToken}
          loading={loading || actions.mutating}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        {headerError && <div className="banner banner-error">{headerError}</div>}
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
              loadedCount={view === 'actions' ? actions.runs.length : prData.prs.length}
            />
            <Filters
              mode={view}
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
              withinDays={filters.withinDays}
              onWithinDaysChange={filters.setWithinDays}
              loaded={prData.prs.length}
              hasMore={prData.pageInfo.hasNextPage}
              onExport={workspace.downloadLocalBackup}
              onImportFile={workspace.handleImportFile}
              onClearLocalData={workspace.handleClearLocalData}
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

            <ViewTabs view={view} onChange={setView} />

            {workspace.scope.type === 'repo' ? (
              <p className="main-scope">
                Repo: <code>{workspace.scope.name}</code>
                {view === 'prs' && !filters.mineOnly && ' · todos os autores'}
              </p>
            ) : workspace.scope.type === 'folder' ? (
              <p className="main-scope">
                Pasta: <strong>{folderName ?? '…'}</strong>
                {` · ${scopeReposCount} repo${scopeReposCount === 1 ? '' : 's'}`}
              </p>
            ) : (
              <p className="main-scope">
                {view === 'actions'
                  ? 'Selecione um repo ou uma pasta para ver Actions.'
                  : 'Sua rede (somente você). Selecione um repo ou uma pasta.'}
              </p>
            )}

            {loading && <p className="main-loading">Carregando…</p>}
          </div>

          <div className="main-content">
            {!auth.token && !loading ? (
              <div className="graph-empty">
                <p>
                  Cole um Personal Access Token acima e clique em <strong>Salvar</strong> para
                  carregar {view === 'actions' ? 'Actions' : 'PRs'}.
                </p>
              </div>
            ) : view === 'prs' ? (
              <PrList
                prs={filtered}
                selectedId={selectedListId}
                notes={workspace.notes}
                pins={workspace.pins}
                onSelect={prData.setSelectedPr}
                hasMore={prData.pageInfo.hasNextPage}
                loading={prData.loading}
                loadingMore={prData.loadingMore}
                onLoadMore={prData.loadMore}
              />
            ) : actionsNetworkHint ? (
              <div className="graph-empty">
                <p>
                  Na aba Actions, escolha um <strong>repositório</strong> ou uma{' '}
                  <strong>pasta</strong> na sidebar.
                </p>
              </div>
            ) : (
              <ActionsList
                runs={filteredRuns}
                selectedId={selectedRunId}
                onSelect={actions.selectRun}
                query={actionsQuery}
                onQueryChange={setActionsQuery}
                statusFilter={actionsStatus}
                onStatusFilterChange={setActionsStatus}
                withinDays={actionsWithinDays}
                onWithinDaysChange={setActionsWithinDays}
                notesOnly={actionsNotesOnly}
                onNotesOnlyChange={setActionsNotesOnly}
                notes={workspace.notes}
                loading={actions.loading}
                canDispatch={dispatchRepos.length > 0}
                dispatchDisabled={!auth.token || actions.mutating || actions.loading}
                onDispatchClick={() => setDispatchOpen(true)}
              />
            )}
          </div>

          {view === 'prs' ? (
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
          ) : (
            <ActionDetail
              run={actions.selectedRun}
              jobs={actions.jobs}
              jobsLoading={actions.jobsLoading}
              mutating={actions.mutating}
              note={
                actions.selectedRun
                  ? (workspace.notes[
                      actionNoteKey(actions.selectedRun.repo, actions.selectedRun.id)
                    ] ?? '')
                  : ''
              }
              onNoteChange={workspace.handleNoteChange}
              onCancel={actions.cancelRun}
              onRerun={actions.rerun}
              onEnsureDetail={actions.ensureSelectedRunDetail}
              onClose={() => actions.selectRun(null)}
            />
          )}
        </section>
      </div>

      <RepoOrganizer
        open={workspace.organizerOpen}
        repos={prData.viewerRepos}
        layout={workspace.layout}
        onChange={workspace.updateLayout}
        onClose={() => workspace.setOrganizerOpen(false)}
      />

      <DispatchModal
        open={dispatchOpen}
        repos={dispatchRepos}
        initialRepo={dispatchInitialRepo}
        onClose={() => setDispatchOpen(false)}
        loadWorkflows={actions.loadWorkflowsForRepo}
        loadDefaultBranch={actions.loadDefaultBranch}
        loadBranches={actions.loadBranches}
        loadInputs={actions.loadDispatchInputs}
        onDispatch={actions.dispatch}
        busy={actions.mutating}
      />
    </div>
  )
}
