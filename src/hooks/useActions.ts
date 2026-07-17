/**
 * Carrega runs de Actions e orquestra mutações (cancel / rerun / dispatch).
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type {
  WorkflowInput,
  WorkflowJob,
  WorkflowRun,
  WorkflowSummary,
} from '../domain/workflowRun'
import { isRunInProgress, mergeWorkflowRunDetail, runKey } from '../domain/workflowRun'
import {
  cancelWorkflowRun,
  dispatchWorkflow,
  fetchFolderWorkflowRuns,
  fetchRepoBranches,
  fetchRepoDefaultBranch,
  fetchRepoWorkflowRuns,
  fetchRepoWorkflows,
  fetchWorkflowDispatchInputs,
  fetchWorkflowRun,
  fetchWorkflowRunJobs,
  rerunFailedJobs,
  rerunWorkflow,
  type FolderRunsResult,
} from '../github'
import {
  reposInFolder,
  type RepoLayout,
  type SidebarScope,
} from '../storage/repoLayout'

const POLL_MS = 15_000

export function useActions(options: {
  token: string
  scope: SidebarScope
  layout: RepoLayout
  viewerRepos: string[]
  /** Só carrega quando a aba Actions está ativa. */
  active: boolean
}) {
  const { token, scope, layout, viewerRepos, active } = options

  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [loading, setLoading] = useState(false)
  const [mutating, setMutating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedRun, setSelectedRun] = useState<WorkflowRun | null>(null)
  const [jobs, setJobs] = useState<WorkflowJob[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)

  const pollRef = useRef<number | null>(null)
  const selectedKeyRef = useRef<string | null>(null)
  const loadArgsRef = useRef({ token, scope, layout, viewerRepos })
  const hasInProgress = runs.some(isRunInProgress)

  useEffect(() => {
    selectedKeyRef.current = selectedRun
      ? runKey(selectedRun.repo, selectedRun.id)
      : null
  }, [selectedRun])

  useEffect(() => {
    loadArgsRef.current = { token, scope, layout, viewerRepos }
  }, [token, scope, layout, viewerRepos])

  const refreshSelectedJobs = useCallback(async (pat: string, repo: string, runId: number) => {
    setJobsLoading(true)
    try {
      const list = await fetchWorkflowRunJobs(pat, repo, runId)
      if (selectedKeyRef.current === runKey(repo, runId)) {
        setJobs(list)
      }
    } catch {
      if (selectedKeyRef.current === runKey(repo, runId)) {
        setJobs([])
      }
    } finally {
      setJobsLoading(false)
    }
  }, [])

  const loadRuns = useCallback(
    async (pat: string, opts: { scope: SidebarScope; layout: RepoLayout; allRepos: string[] }) => {
      if (!pat) {
        setError('Salve um Personal Access Token para carregar Actions.')
        setRuns([])
        return
      }

      if (opts.scope.type === 'network') {
        setRuns([])
        setError(null)
        setSelectedRun(null)
        setJobs([])
        return
      }

      setLoading(true)
      setError(null)

      try {
        let nextRuns: WorkflowRun[] = []

        if (opts.scope.type === 'folder') {
          const folderRepos = reposInFolder(opts.layout, opts.scope.id, opts.allRepos)
          if (folderRepos.length === 0) {
            setRuns([])
            setSelectedRun(null)
            setJobs([])
            return
          }

          const result: FolderRunsResult = await fetchFolderWorkflowRuns(pat, folderRepos)
          if (result.fatalError) {
            setRuns([])
            setError(result.fatalError)
            setSelectedRun(null)
            setJobs([])
            return
          }

          nextRuns = result.runs
          if (result.errors.length > 0) {
            setError(
              `Alguns repos falharam (${result.errors.length}). Ex.: ${result.errors[0]}`,
            )
          }
        } else {
          nextRuns = await fetchRepoWorkflowRuns(pat, opts.scope.name)
        }

        setRuns((prevRuns) => {
          const prevByKey = new Map(prevRuns.map((r) => [runKey(r.repo, r.id), r]))
          return nextRuns.map((r) => mergeWorkflowRunDetail(r, prevByKey.get(runKey(r.repo, r.id))))
        })
        setSelectedRun((prev) => {
          if (!prev) return null
          const key = runKey(prev.repo, prev.id)
          const fromList = nextRuns.find((r) => runKey(r.repo, r.id) === key)
          return fromList ? mergeWorkflowRunDetail(fromList, prev) : null
        })
      } catch (err) {
        setRuns([])
        setError(err instanceof Error ? err.message : 'Falha ao buscar Actions.')
        setSelectedRun(null)
        setJobs([])
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  const applyRunDetail = useCallback((detailed: WorkflowRun) => {
    const key = runKey(detailed.repo, detailed.id)
    if (selectedKeyRef.current !== key) return
    setSelectedRun(detailed)
    setRuns((prev) =>
      prev.map((r) =>
        runKey(r.repo, r.id) === key ? mergeWorkflowRunDetail(detailed, r) : r,
      ),
    )
  }, [])

  const selectRun = useCallback(
    (run: WorkflowRun | null) => {
      // Atualiza a ref no mesmo tick — senão o GET do detalhe pode descartar o resultado.
      selectedKeyRef.current = run ? runKey(run.repo, run.id) : null
      setSelectedRun(run)
      setJobs([])
      if (!run || !token) return
      void refreshSelectedJobs(token, run.repo, run.id)
      void fetchWorkflowRun(token, run.repo, run.id)
        .then(applyRunDetail)
        .catch(() => {
          /* detalhe é best-effort; jobs/lista já bastam */
        })
    },
    [token, refreshSelectedJobs, applyRunDetail],
  )

  /** Recarrega o run selecionado (inputs/branch) antes de confirmar mutação. */
  const ensureSelectedRunDetail = useCallback(async (): Promise<WorkflowRun | null> => {
    const current = selectedRun
    if (!current || !token) return current
    try {
      const detailed = await fetchWorkflowRun(token, current.repo, current.id)
      applyRunDetail(detailed)
      return detailed
    } catch {
      return current
    }
  }, [selectedRun, token, applyRunDetail])

  useEffect(() => {
    if (!active || !token) return
    // Liga loading no mesmo tick da troca de aba/escopo (evita flash de lista vazia).
    if (scope.type !== 'network') setLoading(true)
    void loadRuns(token, { scope, layout, allRepos: viewerRepos })
  }, [active, token, scope, layout, viewerRepos, loadRuns])

  useEffect(() => {
    setSelectedRun(null)
    setJobs([])
  }, [scope])

  useEffect(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }

    if (!active || !hasInProgress) return

    pollRef.current = window.setInterval(() => {
      const args = loadArgsRef.current
      if (!args.token || args.scope.type === 'network') return
      void loadRuns(args.token, {
        scope: args.scope,
        layout: args.layout,
        allRepos: args.viewerRepos,
      }).then(() => {
        const key = selectedKeyRef.current
        if (!key || !args.token) return
        const hash = key.lastIndexOf('#')
        const repo = key.slice(0, hash)
        const id = Number(key.slice(hash + 1))
        if (!repo || !Number.isFinite(id)) return
        void refreshSelectedJobs(args.token, repo, id)
      })
    }, POLL_MS)

    return () => {
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [active, hasInProgress, loadRuns, refreshSelectedJobs])

  const refresh = useCallback(() => {
    if (!token || !active) return
    void loadRuns(token, { scope, layout, allRepos: viewerRepos }).then(() => {
      if (selectedRun) void refreshSelectedJobs(token, selectedRun.repo, selectedRun.id)
    })
  }, [token, active, scope, layout, viewerRepos, loadRuns, selectedRun, refreshSelectedJobs])

  const resetOnEmptyToken = useCallback(() => {
    setRuns([])
    setSelectedRun(null)
    setJobs([])
    setError('Salve um Personal Access Token para carregar Actions.')
  }, [])

  const withMutation = useCallback(
    async (label: string, fn: () => Promise<void>): Promise<boolean> => {
      if (!token) return false
      setMutating(true)
      setError(null)
      try {
        await fn()
        await loadRuns(token, { scope, layout, allRepos: viewerRepos })
        const key = selectedKeyRef.current
        if (key) {
          const hash = key.lastIndexOf('#')
          const repo = key.slice(0, hash)
          const id = Number(key.slice(hash + 1))
          if (repo && Number.isFinite(id)) {
            await refreshSelectedJobs(token, repo, id)
          }
        }
        return true
      } catch (err) {
        setError(err instanceof Error ? err.message : `Falha ao ${label}.`)
        return false
      } finally {
        setMutating(false)
      }
    },
    [token, scope, layout, viewerRepos, loadRuns, refreshSelectedJobs],
  )

  const cancelRun = useCallback(
    (run: WorkflowRun) =>
      withMutation('cancelar', () => cancelWorkflowRun(token, run.repo, run.id)),
    [token, withMutation],
  )

  const rerun = useCallback(
    (run: WorkflowRun) => withMutation('reexecutar', () => rerunWorkflow(token, run.repo, run.id)),
    [token, withMutation],
  )

  const rerunFailed = useCallback(
    (run: WorkflowRun) =>
      withMutation('reexecutar jobs falhos', () => rerunFailedJobs(token, run.repo, run.id)),
    [token, withMutation],
  )

  const loadWorkflowsForRepo = useCallback(
    async (repoFullName: string): Promise<WorkflowSummary[]> => {
      if (!token) return []
      return fetchRepoWorkflows(token, repoFullName)
    },
    [token],
  )

  const loadDefaultBranch = useCallback(
    async (repoFullName: string): Promise<string> => {
      if (!token) return 'main'
      return fetchRepoDefaultBranch(token, repoFullName)
    },
    [token],
  )

  const loadBranches = useCallback(
    async (repoFullName: string): Promise<string[]> => {
      if (!token) return []
      return fetchRepoBranches(token, repoFullName)
    },
    [token],
  )

  const loadDispatchInputs = useCallback(
    async (
      repoFullName: string,
      workflowPath: string,
      ref?: string,
    ): Promise<WorkflowInput[] | null> => {
      if (!token) return null
      return fetchWorkflowDispatchInputs(token, repoFullName, workflowPath, ref)
    },
    [token],
  )

  const dispatch = useCallback(
    async (
      repoFullName: string,
      workflowId: number,
      ref: string,
      inputs: Record<string, string>,
    ): Promise<boolean> => {
      return withMutation('disparar workflow', () =>
        dispatchWorkflow(token, repoFullName, workflowId, ref, inputs),
      )
    },
    [token, withMutation],
  )

  return {
    runs,
    loading,
    mutating,
    error,
    selectedRun,
    selectRun,
    ensureSelectedRunDetail,
    jobs,
    jobsLoading,
    refresh,
    resetOnEmptyToken,
    cancelRun,
    rerun,
    rerunFailed,
    loadWorkflowsForRepo,
    loadDefaultBranch,
    loadBranches,
    loadDispatchInputs,
    dispatch,
  }
}
