/**
 * Barrel do adaptador GitHub — reexporta a API pública usada pelos hooks.
 */

export { getStoredToken, saveToken } from './token'
export { fetchViewerRepos } from './repos'
export {
  PAGE_SIZE,
  buildSearchQuery,
  fetchPullRequests,
  fetchFolderPullRequests,
  type FetchPrsOptions,
  type FetchPrsResult,
  type FolderFetchResult,
} from './search'
