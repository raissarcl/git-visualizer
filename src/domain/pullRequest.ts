/**
 * Tipos de domínio do PR Network — sem dependência de React ou I/O.
 */

export type PrState = 'OPEN' | 'CLOSED' | 'MERGED'
export type StateFilter = 'all' | PrState
export type MergeableState = 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'

export interface PullRequest {
  id: string
  number: number
  title: string
  url: string
  state: PrState
  createdAt: string
  updatedAt: string
  authorLogin: string
  headRefName: string
  baseRefName: string
  repo: string
  body: string
  mergeable: MergeableState
}

export interface PageInfo {
  hasNextPage: boolean
  endCursor: string | null
}
