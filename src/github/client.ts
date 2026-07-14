/**
 * Cliente HTTP mínimo para a GitHub GraphQL API.
 */

const GITHUB_GRAPHQL = 'https://api.github.com/graphql'

interface GraphQlError {
  message: string
}

/**
 * Executa uma query GraphQL autenticada.
 * @throws Error em 401, HTTP não-OK ou erros GraphQL
 */
export async function graphql<T>(
  token: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(GITHUB_GRAPHQL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  if (res.status === 401) {
    throw new Error('Token inválido ou expirado. Gere um novo PAT no GitHub.')
  }

  if (!res.ok) {
    throw new Error(`GitHub API HTTP ${res.status}: ${res.statusText}`)
  }

  const json = (await res.json()) as T & { errors?: GraphQlError[] }
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '))
  }

  return json
}
