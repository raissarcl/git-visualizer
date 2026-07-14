import type { MergeableState, PageInfo, PrState, PullRequest } from '../domain/pullRequest'

/** Nó GraphQL de PR retornado pela search. */
export interface SearchPullRequestNode {
  id: string
  number: number
  title: string
  url: string
  state: 'OPEN' | 'CLOSED'
  merged: boolean
  createdAt: string
  updatedAt: string
  body: string | null
  mergeable: MergeableState | null
  author: { login: string } | null
  headRefName: string
  baseRefName: string
  repository: { nameWithOwner: string }
}

export interface SearchResponse {
  data?: {
    search: {
      pageInfo: PageInfo
      nodes: Array<SearchPullRequestNode | null>
    }
  }
}

export interface ViewerReposPage {
  pageInfo: PageInfo
  nodes: Array<{ nameWithOwner: string } | null>
}

export interface ViewerReposResponse {
  data?: {
    viewer: {
      repositories?: ViewerReposPage
      repositoriesContributedTo?: ViewerReposPage
    }
  }
}

/** Converte nó GraphQL no modelo de domínio. */
export function mapPr(node: SearchPullRequestNode): PullRequest {
  const state: PrState = node.merged ? 'MERGED' : node.state === 'OPEN' ? 'OPEN' : 'CLOSED'

  return {
    id: node.id,
    number: node.number,
    title: node.title,
    url: node.url,
    state,
    createdAt: node.createdAt,
    updatedAt: node.updatedAt,
    authorLogin: node.author?.login ?? 'unknown',
    headRefName: node.headRefName,
    baseRefName: node.baseRefName,
    repo: node.repository.nameWithOwner,
    body: (node.body ?? '').trim(),
    mergeable: node.mergeable ?? 'UNKNOWN',
  }
}
