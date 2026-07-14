/** Queries GraphQL usadas pelo adaptador GitHub. */

export const SEARCH_PRS = `
  query SearchPullRequests($q: String!, $first: Int!, $after: String) {
    search(query: $q, type: ISSUE, first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        ... on PullRequest {
          id
          number
          title
          url
          state
          merged
          createdAt
          updatedAt
          body
          mergeable
          author {
            login
          }
          headRefName
          baseRefName
          repository {
            nameWithOwner
          }
        }
      }
    }
  }
`

export const VIEWER_OWNED_REPOS = `
  query ViewerOwnedRepos($after: String) {
    viewer {
      repositories(
        first: 100
        after: $after
        orderBy: { field: UPDATED_AT, direction: DESC }
        affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          nameWithOwner
        }
      }
    }
  }
`

export const VIEWER_CONTRIBUTED_REPOS = `
  query ViewerContributedRepos($after: String) {
    viewer {
      repositoriesContributedTo(
        first: 100
        after: $after
        includeUserRepositories: true
        contributionTypes: [COMMIT, ISSUE, PULL_REQUEST, REPOSITORY, PULL_REQUEST_REVIEW]
        orderBy: { field: UPDATED_AT, direction: DESC }
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          nameWithOwner
        }
      }
    }
  }
`
