/**
 * Lista repositórios do viewer (próprios + contribuídos).
 */

import { graphql } from './client'
import type { ViewerReposPage, ViewerReposResponse } from './mappers'
import { VIEWER_CONTRIBUTED_REPOS, VIEWER_OWNED_REPOS } from './queries'

const MAX_REPO_PAGES = 3

async function paginateRepoNames(
  token: string,
  query: string,
  pick: (data: NonNullable<ViewerReposResponse['data']>['viewer']) => ViewerReposPage | undefined,
): Promise<string[]> {
  const names: string[] = []
  let after: string | null = null
  let pages = 0

  while (pages < MAX_REPO_PAGES) {
    const json: ViewerReposResponse = await graphql<ViewerReposResponse>(token, query, { after })
    const page: ViewerReposPage | undefined = json.data?.viewer
      ? pick(json.data.viewer)
      : undefined
    if (!page) break

    for (const node of page.nodes) {
      if (node?.nameWithOwner) names.push(node.nameWithOwner)
    }

    pages += 1
    if (!page.pageInfo.hasNextPage || !page.pageInfo.endCursor) break
    after = page.pageInfo.endCursor
  }

  return names
}

/** Repos owned + contributedTo, deduplicados e ordenados. */
export async function fetchViewerRepos(token: string): Promise<string[]> {
  const [owned, contributed] = await Promise.all([
    paginateRepoNames(token, VIEWER_OWNED_REPOS, (v) => v.repositories),
    paginateRepoNames(token, VIEWER_CONTRIBUTED_REPOS, (v) => v.repositoriesContributedTo),
  ])

  return [...new Set([...owned, ...contributed])].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  )
}
