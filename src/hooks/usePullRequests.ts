/**
 * Carrega repos e PRs do GitHub; gerencia paginação e escopo.
 */

import { useCallback, useEffect, useState } from 'react'
import type { PageInfo, PullRequest, StateFilter } from '../domain/pullRequest'
import {
  fetchFolderPullRequests,
  fetchPullRequests,
  fetchViewerRepos,
} from '../github'
import {
  reposInFolder,
  type RepoLayout,
  type SidebarScope,
} from '../storage/repoLayout'

export function usePullRequests(options: {
  token: string
  mineOnly: boolean
  stateFilter: StateFilter
  scope: SidebarScope
  layout: RepoLayout
}) {
  const { token, mineOnly, stateFilter, scope, layout } = options

  const [viewerRepos, setViewerRepos] = useState<string[]>([])
  const [prs, setPrs] = useState<PullRequest[]>([])
  const [pageInfo, setPageInfo] = useState<PageInfo>({ hasNextPage: false, endCursor: null })
  const [folderCursors, setFolderCursors] = useState<Record<string, string | null>>({})
  const [folderHasMore, setFolderHasMore] = useState<Record<string, boolean>>({})

  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedPr, setSelectedPr] = useState<PullRequest | null>(null)

  const loadRepos = useCallback(async (pat: string) => {
    try {
      const repos = await fetchViewerRepos(pat)
      setViewerRepos(repos)
    } catch {
      setViewerRepos([])
    }
  }, [])

  const loadPrs = useCallback(
    async (
      pat: string,
      opts: {
        mineOnly: boolean
        scope: SidebarScope
        state: StateFilter
        layout: RepoLayout
        allRepos: string[]
        append?: boolean
        cursor?: string | null
        folderCursors?: Record<string, string | null>
        folderHasMore?: Record<string, boolean>
      },
    ) => {
      if (!pat) {
        setError('Salve um Personal Access Token para carregar PRs.')
        setPrs([])
        setPageInfo({ hasNextPage: false, endCursor: null })
        setFolderCursors({})
        setFolderHasMore({})
        return
      }

      const appending = Boolean(opts.append)

      if (appending) setLoadingMore(true)
      else setLoading(true)

      setError(null)

      try {
        if (opts.scope.type === 'folder') {
          const folderRepos = reposInFolder(opts.layout, opts.scope.id, opts.allRepos)

          if (folderRepos.length === 0) {
            setPrs([])
            setPageInfo({ hasNextPage: false, endCursor: null })
            setFolderCursors({})
            setFolderHasMore({})
            if (!appending) setSelectedPr(null)
            return
          }

          const result = await fetchFolderPullRequests(pat, folderRepos, {
            mineOnly: opts.mineOnly,
            state: opts.state,
            cursors: appending ? opts.folderCursors : {},
            hasMore: appending ? opts.folderHasMore : {},
          })

          setPrs((prev) => (appending ? [...prev, ...result.prs] : result.prs))
          setFolderCursors(result.cursors)
          setFolderHasMore(result.hasMore)
          setPageInfo({
            hasNextPage: result.hasNextPage,
            endCursor: null,
          })
        } else {
          const repo = opts.scope.type === 'repo' ? opts.scope.name : null

          const result = await fetchPullRequests(pat, {
            mineOnly: opts.mineOnly,
            repo,
            state: opts.state,
            cursor: opts.cursor ?? null,
          })

          setPrs((prev) => (appending ? [...prev, ...result.prs] : result.prs))
          setPageInfo(result.pageInfo)
          setFolderCursors({})
          setFolderHasMore({})
        }

        if (!appending) setSelectedPr(null)
      } catch (err) {
        if (!appending) setPrs([])
        setError(err instanceof Error ? err.message : 'Falha ao buscar PRs.')
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!token) return
    loadRepos(token)
  }, [token, loadRepos])

  useEffect(() => {
    if (!token) return

    loadPrs(token, {
      mineOnly,
      scope,
      state: stateFilter,
      layout,
      allRepos: viewerRepos,
      append: false,
    })
  }, [token, mineOnly, scope, stateFilter, layout, viewerRepos, loadPrs])

  const loadMore = useCallback(() => {
    if (!token || !pageInfo.hasNextPage || loadingMore) return

    loadPrs(token, {
      mineOnly,
      scope,
      state: stateFilter,
      layout,
      allRepos: viewerRepos,
      append: true,
      cursor: pageInfo.endCursor,
      folderCursors,
      folderHasMore,
    })
  }, [
    token,
    pageInfo,
    loadingMore,
    loadPrs,
    mineOnly,
    scope,
    stateFilter,
    layout,
    viewerRepos,
    folderCursors,
    folderHasMore,
  ])

  const refresh = useCallback(() => {
    if (!token) return

    loadRepos(token)
    loadPrs(token, {
      mineOnly,
      scope,
      state: stateFilter,
      layout,
      allRepos: viewerRepos,
      append: false,
    })
  }, [token, loadRepos, loadPrs, mineOnly, scope, stateFilter, layout, viewerRepos])

  const resetOnEmptyToken = useCallback(() => {
    setPrs([])
    setViewerRepos([])
    setPageInfo({ hasNextPage: false, endCursor: null })
    setError('Salve um Personal Access Token para carregar PRs.')
  }, [])

  return {
    viewerRepos,
    prs,
    pageInfo,
    loading,
    loadingMore,
    error,
    selectedPr,
    setSelectedPr,
    loadMore,
    refresh,
    resetOnEmptyToken,
  }
}
