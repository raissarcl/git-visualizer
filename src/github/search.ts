/**
 * Busca de PRs via GitHub search GraphQL (página e pasta multi-repo).
 */

import type { PageInfo, PullRequest, StateFilter } from '../domain/pullRequest'
import { graphql } from './client'
import { mapPr, type SearchResponse } from './mappers'
import { SEARCH_PRS } from './queries'

export const PAGE_SIZE = 50

export interface FetchPrsResult {
  prs: PullRequest[]
  pageInfo: PageInfo
}

export interface FetchPrsOptions {
  mineOnly: boolean
  repo?: string | null
  state?: StateFilter
  cursor?: string | null
}

/**
 * Monta a query de search do GitHub.
 * Sem repo: `involves:@me` (ou `author:@me`). Com repo: escopo do repositório.
 */
export function buildSearchQuery(options: {
  mineOnly: boolean
  repo?: string | null
  state?: StateFilter
}): string {
  const parts = ['is:pr']

  if (options.repo) {
    parts.push(`repo:${options.repo}`)
    if (options.mineOnly) {
      parts.push('author:@me')
    }
  } else if (options.mineOnly) {
    parts.push('author:@me')
  } else {
    parts.push('involves:@me')
  }

  if (options.state === 'OPEN') {
    parts.push('is:open')
  } else if (options.state === 'MERGED') {
    parts.push('is:merged')
  } else if (options.state === 'CLOSED') {
    parts.push('is:closed', 'is:unmerged')
  }

  parts.push('sort:updated-desc')
  return parts.join(' ')
}

export async function fetchPullRequests(
  token: string,
  options: FetchPrsOptions,
): Promise<FetchPrsResult> {
  const q = buildSearchQuery({
    mineOnly: options.mineOnly,
    repo: options.repo,
    state: options.state ?? 'all',
  })

  const json = await graphql<SearchResponse>(token, SEARCH_PRS, {
    q,
    first: PAGE_SIZE,
    after: options.cursor ?? null,
  })

  const search = json.data?.search
  if (!search) {
    throw new Error('Resposta inesperada da GitHub GraphQL API.')
  }

  const prs: PullRequest[] = []
  for (const node of search.nodes) {
    if (node && 'number' in node && node.headRefName) {
      prs.push(mapPr(node))
    }
  }

  return {
    prs,
    pageInfo: search.pageInfo,
  }
}

export interface FolderFetchResult {
  prs: PullRequest[]
  cursors: Record<string, string | null>
  hasMore: Record<string, boolean>
  hasNextPage: boolean
}

/** Uma página por repo da pasta; resultado mesclado por `updatedAt`. */
export async function fetchFolderPullRequests(
  token: string,
  repos: string[],
  options: {
    mineOnly: boolean
    state?: StateFilter
    cursors?: Record<string, string | null>
    hasMore?: Record<string, boolean>
  },
): Promise<FolderFetchResult> {
  if (repos.length === 0) {
    return { prs: [], cursors: {}, hasMore: {}, hasNextPage: false }
  }

  const prevCursors = options.cursors ?? {}
  const prevHasMore = options.hasMore ?? {}
  const toFetch = repos.filter((repo) => prevHasMore[repo] !== false)

  const results = await Promise.all(
    toFetch.map(async (repo) => {
      const page = await fetchPullRequests(token, {
        mineOnly: options.mineOnly,
        repo,
        state: options.state ?? 'all',
        cursor: prevCursors[repo] ?? null,
      })
      return { repo, page }
    }),
  )

  const prs: PullRequest[] = []
  const cursors: Record<string, string | null> = { ...prevCursors }
  const hasMore: Record<string, boolean> = { ...prevHasMore }

  for (const { repo, page } of results) {
    prs.push(...page.prs)
    cursors[repo] = page.pageInfo.endCursor
    hasMore[repo] = page.pageInfo.hasNextPage
  }

  prs.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))

  return {
    prs,
    cursors,
    hasMore,
    hasNextPage: Object.values(hasMore).some(Boolean),
  }
}
