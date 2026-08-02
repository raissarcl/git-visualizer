/**
 * Branches remotas — listagem pontual e verificação.
 */

import { restGetOrNull } from './rest'

function splitRepo(fullName: string): { owner: string; repo: string } {
  const [owner, repo] = fullName.split('/')
  if (!owner || !repo)
    throw new Error(`Nome de repositório inválido: ${fullName}`)
  return { owner, repo }
}

/**
 * Verifica se a branch existe no remoto.
 * `GET /repos/{owner}/{repo}/branches/{branch}` → verified | missing.
 */
export async function checkRepoBranch(
  token: string,
  repoFullName: string,
  branch: string,
): Promise<'verified' | 'missing'> {
  const trimmed = branch.trim()
  if (!trimmed) return 'missing'

  const { owner, repo } = splitRepo(repoFullName)
  const encoded = encodeURIComponent(trimmed)
  const data = await restGetOrNull<{ name?: string }>(
    token,
    `/repos/${owner}/${repo}/branches/${encoded}`,
  )
  return data ? 'verified' : 'missing'
}
