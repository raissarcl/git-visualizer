/**
 * Adaptador REST para GitHub Actions (runs, jobs, workflows, dispatch).
 */

import type {
  WorkflowJob,
  WorkflowRun,
  WorkflowSummary,
  WorkflowInput,
} from '../domain/workflowRun'
import { sortRunsByCreatedDesc } from '../domain/workflowRun'
import { mapPool, parseLinkNext, restGet, restGetWithLink, restPost } from './rest'
import { parseWorkflowDispatchDetailed } from './workflowYaml'

const RUNS_PER_PAGE = 20
const FOLDER_CONCURRENCY = 5

interface RestActor {
  login?: string
}

interface RestWorkflowRun {
  id: number
  name: string | null
  display_title?: string | null
  status: string
  conclusion: string | null
  html_url: string
  head_branch: string | null
  head_sha?: string | null
  event: string
  actor: RestActor | null
  created_at: string
  updated_at: string
  run_number: number
  workflow_id: number
  path?: string | null
  inputs?: Record<string, string | number | boolean | null> | null
}

interface RestRunsResponse {
  workflow_runs: RestWorkflowRun[]
}

interface RestJob {
  id: number
  name: string
  status: string
  conclusion: string | null
  html_url: string
  started_at: string | null
  completed_at: string | null
}

interface RestJobsResponse {
  jobs: RestJob[]
}

interface RestWorkflow {
  id: number
  name: string
  path: string
  state: string
  html_url: string
}

interface RestWorkflowsResponse {
  workflows: RestWorkflow[]
}

interface RestContentFile {
  type: string
  encoding: string
  content?: string
  path: string
  download_url?: string | null
}

function decodeBase64Utf8(b64: string): string {
  const binary = atob(b64.replace(/\n/g, ''))
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

interface RestRepo {
  default_branch: string
}

function splitRepo(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split('/')
  if (!owner || !repo) throw new Error(`Nome de repositório inválido: ${fullName}`)
  return { owner, repo }
}

function mapRunInputs(
  raw: RestWorkflowRun['inputs'],
): Record<string, string> {
  if (!raw || typeof raw !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw)) {
    out[key] = value == null ? '' : String(value)
  }
  return out
}

function mapRun(raw: RestWorkflowRun, repo: string): WorkflowRun {
  return {
    id: raw.id,
    databaseId: String(raw.id),
    name: raw.name?.trim() || 'Workflow',
    displayTitle: raw.display_title?.trim() || raw.name?.trim() || `Run #${raw.run_number}`,
    status: raw.status as WorkflowRun['status'],
    conclusion: raw.conclusion as WorkflowRun['conclusion'],
    htmlUrl: raw.html_url,
    repo,
    headBranch: raw.head_branch ?? '',
    headSha: raw.head_sha ?? '',
    event: raw.event,
    actorLogin: raw.actor?.login ?? 'unknown',
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    runNumber: raw.run_number,
    workflowId: raw.workflow_id,
    workflowPath: raw.path ?? '',
    inputs: mapRunInputs(raw.inputs),
  }
}

function mapJob(raw: RestJob): WorkflowJob {
  return {
    id: raw.id,
    name: raw.name,
    status: raw.status as WorkflowJob['status'],
    conclusion: raw.conclusion as WorkflowJob['conclusion'],
    htmlUrl: raw.html_url,
    startedAt: raw.started_at,
    completedAt: raw.completed_at,
  }
}

function mapWorkflow(raw: RestWorkflow): WorkflowSummary {
  return {
    id: raw.id,
    name: raw.name,
    path: raw.path,
    state: raw.state,
    htmlUrl: raw.html_url,
  }
}

export async function fetchRepoWorkflowRuns(
  token: string,
  repoFullName: string,
  perPage = RUNS_PER_PAGE,
): Promise<WorkflowRun[]> {
  const { owner, repo } = splitRepo(repoFullName)
  const data = await restGet<RestRunsResponse>(
    token,
    `/repos/${owner}/${repo}/actions/runs?per_page=${perPage}`,
  )
  return sortRunsByCreatedDesc((data.workflow_runs ?? []).map((r) => mapRun(r, repoFullName)))
}

export interface FolderRunsResult {
  runs: WorkflowRun[]
  /** Erros por repo (parcial); se todos falharem, `fatalError` vem preenchido. */
  errors: string[]
  fatalError: string | null
}

/** Runs de vários repos com concorrência limitada, ordenados por createdAt desc. */
export async function fetchFolderWorkflowRuns(
  token: string,
  repos: string[],
  perPage = RUNS_PER_PAGE,
): Promise<FolderRunsResult> {
  const batches = await mapPool(repos, FOLDER_CONCURRENCY, async (name) => {
    try {
      return { ok: true as const, runs: await fetchRepoWorkflowRuns(token, name, perPage) }
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : `Falha em ${name}`,
      }
    }
  })

  const runs = sortRunsByCreatedDesc(
    batches.flatMap((b) => (b.ok ? b.runs : [])),
  )
  const errors = batches.flatMap((b) => (b.ok ? [] : [b.error]))
  const allFailed = repos.length > 0 && errors.length === repos.length

  return {
    runs,
    errors,
    fatalError: allFailed ? (errors[0] ?? 'Falha ao buscar Actions da pasta.') : null,
  }
}

export async function fetchWorkflowRunJobs(
  token: string,
  repoFullName: string,
  runId: number,
): Promise<WorkflowJob[]> {
  const { owner, repo } = splitRepo(repoFullName)
  const data = await restGet<RestJobsResponse>(
    token,
    `/repos/${owner}/${repo}/actions/runs/${runId}/jobs?per_page=100`,
  )
  return (data.jobs ?? []).map(mapJob)
}

/** Detalhe do run (inclui inputs de workflow_dispatch com mais fidelidade). */
export async function fetchWorkflowRun(
  token: string,
  repoFullName: string,
  runId: number,
): Promise<WorkflowRun> {
  const { owner, repo } = splitRepo(repoFullName)
  const data = await restGet<RestWorkflowRun>(
    token,
    `/repos/${owner}/${repo}/actions/runs/${runId}`,
  )
  return mapRun(data, repoFullName)
}

export async function cancelWorkflowRun(
  token: string,
  repoFullName: string,
  runId: number,
): Promise<void> {
  const { owner, repo } = splitRepo(repoFullName)
  await restPost(token, `/repos/${owner}/${repo}/actions/runs/${runId}/cancel`)
}

export async function rerunWorkflow(
  token: string,
  repoFullName: string,
  runId: number,
): Promise<void> {
  const { owner, repo } = splitRepo(repoFullName)
  await restPost(token, `/repos/${owner}/${repo}/actions/runs/${runId}/rerun`)
}

export async function rerunFailedJobs(
  token: string,
  repoFullName: string,
  runId: number,
): Promise<void> {
  const { owner, repo } = splitRepo(repoFullName)
  await restPost(token, `/repos/${owner}/${repo}/actions/runs/${runId}/rerun-failed-jobs`)
}

export async function fetchRepoWorkflows(
  token: string,
  repoFullName: string,
): Promise<WorkflowSummary[]> {
  const { owner, repo } = splitRepo(repoFullName)
  const data = await restGet<RestWorkflowsResponse>(
    token,
    `/repos/${owner}/${repo}/actions/workflows?per_page=100`,
  )
  return (data.workflows ?? [])
    .map(mapWorkflow)
    .filter((w) => w.state === 'active' && !w.path.startsWith('dynamic/'))
}

export async function fetchRepoDefaultBranch(
  token: string,
  repoFullName: string,
): Promise<string> {
  const { owner, repo } = splitRepo(repoFullName)
  const data = await restGet<RestRepo>(token, `/repos/${owner}/${repo}`)
  return data.default_branch || 'main'
}

const MAX_BRANCH_PAGES = 3

interface RestBranch {
  name: string
}

/** Lista branches do repo (até ~300, paginado). */
export async function fetchRepoBranches(
  token: string,
  repoFullName: string,
): Promise<string[]> {
  const { owner, repo } = splitRepo(repoFullName)
  const names: string[] = []
  let next: string | null = `/repos/${owner}/${repo}/branches?per_page=100`
  let pages = 0

  while (next && pages < MAX_BRANCH_PAGES) {
    const { data, link } = await restGetWithLink<RestBranch[]>(token, next)
    for (const b of data) {
      if (b.name) names.push(b.name)
    }
    pages += 1
    next = parseLinkNext(link)
  }

  return names
}

/**
 * Baixa o YAML do workflow e extrai inputs de workflow_dispatch (`null` se não houver).
 * @param ref Branch/tag/SHA — se omitido, usa a default branch do repo.
 * Em falha de interpretação, lança Error com path/ref/chaves de `on` para diagnóstico.
 */
export async function fetchWorkflowDispatchInputs(
  token: string,
  repoFullName: string,
  workflowPath: string,
  ref?: string,
): Promise<WorkflowInput[] | null> {
  const { owner, repo } = splitRepo(repoFullName)
  const encodedPath = workflowPath
    .split('/')
    .map((p) => encodeURIComponent(p))
    .join('/')

  const refLabel = ref?.trim() || 'default'
  const refQ = ref?.trim() ? `?ref=${encodeURIComponent(ref.trim())}` : ''
  const file = await restGet<RestContentFile>(
    token,
    `/repos/${owner}/${repo}/contents/${encodedPath}${refQ}`,
  )

  if (file.type && file.type !== 'file') {
    throw new Error(`O path “${workflowPath}” não é um arquivo (type=${file.type}).`)
  }

  let yamlText = ''
  if (file.encoding === 'base64' && file.content) {
    yamlText = decodeBase64Utf8(file.content)
  } else if (file.download_url) {
    const raw = await fetch(file.download_url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw' },
    })
    if (!raw.ok) {
      throw new Error(`Falha ao baixar YAML (${raw.status}) em ${workflowPath}@${refLabel}.`)
    }
    yamlText = await raw.text()
  } else {
    throw new Error(`Não foi possível ler o arquivo do workflow (${workflowPath}).`)
  }

  const parsed = parseWorkflowDispatchDetailed(yamlText)

  if (parsed.parseError && parsed.inputs === null && !parsed.rawMentionsDispatch) {
    throw new Error(
      `YAML inválido em ${workflowPath}@${refLabel}: ${parsed.parseError}`,
    )
  }

  if (parsed.inputs === null) {
    const keys =
      parsed.onKeys.length > 0 ? parsed.onKeys.join(', ') : '(nenhum gatilho em on:)'
    const hint = parsed.rawMentionsDispatch
      ? ' O texto menciona workflow_dispatch, mas não ficou sob on: — confira indentação/YAML.'
      : ' Nesse arquivo/ref não há workflow_dispatch em on:.'
    throw new Error(
      `Arquivo ${workflowPath} @ ${refLabel}. Gatilhos lidos: ${keys}.${hint}`,
    )
  }

  return parsed.inputs
}

export async function dispatchWorkflow(
  token: string,
  repoFullName: string,
  workflowId: number,
  ref: string,
  inputs: Record<string, string>,
): Promise<void> {
  const { owner, repo } = splitRepo(repoFullName)
  const body: { ref: string; inputs?: Record<string, string> } = { ref }
  if (Object.keys(inputs).length > 0) body.inputs = inputs
  await restPost(token, `/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`, body)
}
