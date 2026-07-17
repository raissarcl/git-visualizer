/**
 * Tipos e regras puras de GitHub Actions — sem React ou I/O.
 */

import { isWithinDays } from './filters'

export type RunStatus =
  | 'queued'
  | 'in_progress'
  | 'completed'
  | 'waiting'
  | 'requested'
  | 'pending'
  | 'action_required'

export type RunConclusion =
  | 'success'
  | 'failure'
  | 'cancelled'
  | 'skipped'
  | 'timed_out'
  | 'action_required'
  | 'neutral'
  | 'stale'
  | 'startup_failure'
  | null

export type ActionsStatusFilter = 'all' | 'failure' | 'in_progress' | 'success'

export interface WorkflowRun {
  id: number
  databaseId: string
  name: string
  displayTitle: string
  status: RunStatus
  conclusion: RunConclusion
  htmlUrl: string
  repo: string
  /** Branch em que o run executou (destino do checkout). */
  headBranch: string
  /** SHA do commit da head. */
  headSha: string
  event: string
  actorLogin: string
  createdAt: string
  updatedAt: string
  runNumber: number
  workflowId: number
  workflowPath: string
  /** Inputs usados no disparo (workflow_dispatch); vazio se não houver. */
  inputs: Record<string, string>
}

export interface WorkflowJob {
  id: number
  name: string
  status: RunStatus
  conclusion: RunConclusion
  htmlUrl: string
  startedAt: string | null
  completedAt: string | null
}

export interface WorkflowSummary {
  id: number
  name: string
  path: string
  state: string
  htmlUrl: string
}

export type WorkflowInputType = 'string' | 'boolean' | 'choice' | 'environment' | 'number'

export interface WorkflowInput {
  name: string
  description: string
  required: boolean
  type: WorkflowInputType
  defaultValue: string
  options: string[]
}

export interface LocalActionsFilters {
  query: string
  status: ActionsStatusFilter
  /** 0 = desligado; filtra por createdAt nos últimos N dias (1 = 24h) */
  withinDays: 0 | 1 | 7 | 30
  notesOnly?: boolean
  /** Mapa de notas locais (keys `run:owner/repo#id`) */
  notes?: Record<string, string>
}

/** Chave estável para seleção na UI. */
export function runKey(repo: string, runId: number): string {
  return `${repo}#${runId}`
}

/** Mantém inputs/sha do detalhe quando a lista volta sem eles. */
export function mergeWorkflowRunDetail(
  fromList: WorkflowRun,
  previous: WorkflowRun | null | undefined,
): WorkflowRun {
  if (!previous || runKey(previous.repo, previous.id) !== runKey(fromList.repo, fromList.id)) {
    return fromList
  }
  const listHasInputs = Object.keys(fromList.inputs).length > 0
  return {
    ...fromList,
    inputs: listHasInputs ? fromList.inputs : previous.inputs,
    headSha: fromList.headSha || previous.headSha,
    headBranch: fromList.headBranch || previous.headBranch,
    workflowPath: fromList.workflowPath || previous.workflowPath,
  }
}

/**
 * Chave de nota local do run — prefixo evita colisão com `prKey` (`owner/repo#n`).
 * @example actionNoteKey('acme/api', 99) // 'run:acme/api#99'
 */
export function actionNoteKey(repo: string, runId: number): string {
  return `run:${repo}#${runId}`
}

export function isRunInProgress(run: Pick<WorkflowRun, 'status'>): boolean {
  return (
    run.status === 'queued' ||
    run.status === 'in_progress' ||
    run.status === 'waiting' ||
    run.status === 'requested' ||
    run.status === 'pending'
  )
}

export function canCancel(run: Pick<WorkflowRun, 'status'>): boolean {
  return isRunInProgress(run)
}

export function canRerun(run: Pick<WorkflowRun, 'status'>): boolean {
  return run.status === 'completed'
}

export function canRerunFailed(run: Pick<WorkflowRun, 'status' | 'conclusion'>): boolean {
  return (
    run.status === 'completed' &&
    (run.conclusion === 'failure' ||
      run.conclusion === 'timed_out' ||
      run.conclusion === 'startup_failure')
  )
}

/** Badge visual: prioriza conclusion quando completed. */
export function runBadgeKind(
  run: Pick<WorkflowRun, 'status' | 'conclusion'>,
): 'success' | 'failure' | 'cancelled' | 'in_progress' | 'queued' | 'neutral' {
  if (isRunInProgress(run)) {
    return run.status === 'queued' || run.status === 'pending' ? 'queued' : 'in_progress'
  }
  if (run.conclusion === 'success') return 'success'
  if (
    run.conclusion === 'failure' ||
    run.conclusion === 'timed_out' ||
    run.conclusion === 'startup_failure'
  ) {
    return 'failure'
  }
  if (run.conclusion === 'cancelled') return 'cancelled'
  return 'neutral'
}

export function runBadgeLabel(run: Pick<WorkflowRun, 'status' | 'conclusion'>): string {
  const kind = runBadgeKind(run)
  if (kind === 'in_progress') return 'em andamento'
  if (kind === 'queued') return 'na fila'
  if (kind === 'success') return 'sucesso'
  if (kind === 'failure') return 'falhou'
  if (kind === 'cancelled') return 'cancelado'
  return run.conclusion ?? run.status
}

function matchesStatusFilter(run: WorkflowRun, status: ActionsStatusFilter): boolean {
  if (status === 'all') return true
  if (status === 'in_progress') return isRunInProgress(run)
  if (status === 'success') return run.status === 'completed' && run.conclusion === 'success'
  if (status === 'failure') return canRerunFailed(run)
  return true
}

export function filterWorkflowRuns(
  runs: WorkflowRun[],
  filters: LocalActionsFilters,
): WorkflowRun[] {
  const q = filters.query.trim().toLowerCase()
  const now = Date.now()
  let result = runs.filter((run) => matchesStatusFilter(run, filters.status))

  if (q) {
    result = result.filter(
      (run) =>
        run.name.toLowerCase().includes(q) ||
        run.displayTitle.toLowerCase().includes(q) ||
        run.repo.toLowerCase().includes(q) ||
        run.headBranch.toLowerCase().includes(q) ||
        run.event.toLowerCase().includes(q) ||
        run.actorLogin.toLowerCase().includes(q) ||
        String(run.runNumber).includes(q),
    )
  }

  if (filters.withinDays > 0) {
    result = result.filter((run) => isWithinDays(run.createdAt, filters.withinDays, now))
  }

  if (filters.notesOnly && filters.notes) {
    const notes = filters.notes
    result = result.filter((run) => Boolean(notes[actionNoteKey(run.repo, run.id)]?.trim()))
  }

  return result
}

/** Falhas primeiro; depois por createdAt desc (ordem relativa preservada nos grupos). */
export function sortRunsFailedFirst(runs: WorkflowRun[]): WorkflowRun[] {
  const failed: WorkflowRun[] = []
  const rest: WorkflowRun[] = []
  for (const run of runs) {
    if (canRerunFailed(run)) failed.push(run)
    else rest.push(run)
  }
  return [...failed, ...rest]
}

export function sortRunsByCreatedDesc(runs: WorkflowRun[]): WorkflowRun[] {
  return [...runs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

function normalizeInputName(name: string): string {
  return name.toLowerCase().replace(/-/g, '_')
}

/**
 * Inputs string/environment cujo nome sugere branch/ref/deploy → seletor de branches.
 * Choice com options do YAML e boolean ficam como estão.
 */
export function isBranchLikeInput(input: Pick<WorkflowInput, 'name' | 'type' | 'options'>): boolean {
  if (input.type === 'boolean' || input.type === 'number') return false
  if (input.type === 'choice' && input.options.length > 0) return false

  const n = normalizeInputName(input.name)
  if (n === 'ref' || n === 'branch') return true
  if (n.includes('branch')) return true
  if (n.endsWith('_ref') || n === 'git_ref') return true
  return false
}
