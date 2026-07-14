/**
 * Chave estável de um PR no app: `owner/repo#number`.
 * Usada por notas, pins e seleção na UI.
 *
 * @example
 * prKey('acme/api', 42) // 'acme/api#42'
 */
export function prKey(repo: string, number: number): string {
  return `${repo}#${number}`
}