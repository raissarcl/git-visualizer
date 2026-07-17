/**
 * Cliente HTTP mínimo para a GitHub REST API.
 */

const GITHUB_API = 'https://api.github.com'
const API_VERSION = '2022-11-28'

function authHeaders(token: string, extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  headers.set('Authorization', `Bearer ${token}`)
  headers.set('Accept', 'application/vnd.github+json')
  headers.set('X-GitHub-Api-Version', API_VERSION)
  return headers
}

function statusMessage(status: number, statusText: string, bodyText: string): string {
  if (status === 401) {
    return 'Token inválido ou expirado. Gere um novo PAT no GitHub.'
  }
  if (status === 403) {
    return (
      'Sem permissão para Actions. No fine-grained PAT, habilite Actions: Read and write. ' +
      'No classic, use o scope repo (ou public_repo).'
    )
  }
  if (status === 404) {
    return 'Recurso não encontrado (repo, workflow ou run).'
  }

  let detail = statusText
  try {
    const json = JSON.parse(bodyText) as { message?: string }
    if (json.message) detail = json.message
  } catch {
    if (bodyText.trim()) detail = bodyText.trim().slice(0, 200)
  }

  return `GitHub API HTTP ${status}: ${detail}`
}

async function parseError(res: Response): Promise<never> {
  const bodyText = await res.text().catch(() => '')
  throw new Error(statusMessage(res.status, res.statusText, bodyText))
}

/**
 * GET JSON autenticado.
 * @throws Error em 401/403/HTTP não-OK
 */
export async function restGet<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: 'GET',
    headers: authHeaders(token),
  })

  if (!res.ok) await parseError(res)
  return (await res.json()) as T
}

/**
 * GET JSON autenticado com header Link (paginação).
 * @throws Error em 401/403/HTTP não-OK
 */
export async function restGetWithLink<T>(
  token: string,
  pathOrUrl: string,
): Promise<{ data: T; link: string | null }> {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${GITHUB_API}${pathOrUrl}`
  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(token),
  })

  if (!res.ok) await parseError(res)
  const data = (await res.json()) as T
  return { data, link: res.headers.get('Link') }
}

/** Extrai URL rel="next" do header Link do GitHub. */
export function parseLinkNext(linkHeader: string | null): string | null {
  if (!linkHeader) return null
  for (const part of linkHeader.split(',')) {
    const match = part.trim().match(/^<([^>]+)>\s*;\s*rel="next"$/)
    if (match?.[1]) return match[1]
  }
  return null
}

/**
 * POST JSON autenticado. Aceita 204 sem corpo.
 * @throws Error em 401/403/HTTP não-OK
 */
export async function restPost<T = unknown>(
  token: string,
  path: string,
  body?: unknown,
): Promise<T | null> {
  const headers = authHeaders(token)
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }

  const res = await fetch(`${GITHUB_API}${path}`, {
    method: 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!res.ok) await parseError(res)
  if (res.status === 204) return null

  const text = await res.text()
  if (!text) return null
  return JSON.parse(text) as T
}

/** Executa tarefas com limite de concorrência. */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []
  const limit = Math.max(1, concurrency)
  const results: R[] = new Array(items.length)
  let next = 0

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next
      next += 1
      results[i] = await fn(items[i]!)
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker())
  await Promise.all(workers)
  return results
}
