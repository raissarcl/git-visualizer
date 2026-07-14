import { describe, expect, it } from 'vitest'
import { filterByQuery, filterPullRequests, sortPinnedFirst } from './filters'
import type { PullRequest } from './pullRequest'
import { prKey } from './prKey'

function pr(partial: Partial<PullRequest> & Pick<PullRequest, 'number' | 'repo'>): PullRequest {
  return {
    id: partial.id ?? `id-${partial.repo}-${partial.number}`,
    title: partial.title ?? 'Title',
    url: partial.url ?? 'https://example.com',
    state: partial.state ?? 'OPEN',
    createdAt: partial.createdAt ?? '2026-01-01T00:00:00Z',
    updatedAt: partial.updatedAt ?? '2026-01-02T00:00:00Z',
    authorLogin: partial.authorLogin ?? 'alice',
    headRefName: partial.headRefName ?? 'feature',
    baseRefName: partial.baseRefName ?? 'main',
    body: partial.body ?? '',
    mergeable: partial.mergeable ?? 'MERGEABLE',
    number: partial.number,
    repo: partial.repo,
  }
}

describe('prKey', () => {
  it('formats owner/repo#number', () => {
    expect(prKey('acme/api', 12)).toBe('acme/api#12')
  })
})

describe('filterByQuery', () => {
  const list = [
    pr({ repo: 'acme/a', number: 1, title: 'Add login', authorLogin: 'bob' }),
    pr({ repo: 'acme/b', number: 2, title: 'Fix typo', headRefName: 'hotfix' }),
  ]

  it('returns all when query empty', () => {
    expect(filterByQuery(list, '  ')).toHaveLength(2)
  })

  it('matches title and author', () => {
    expect(filterByQuery(list, 'login')).toHaveLength(1)
    expect(filterByQuery(list, 'bob')[0]?.number).toBe(1)
  })
})

describe('filterPullRequests', () => {
  const old = pr({
    repo: 'acme/a',
    number: 1,
    createdAt: '2020-01-01T00:00:00Z',
    mergeable: 'CONFLICTING',
  })
  const fresh = pr({
    repo: 'acme/a',
    number: 2,
    createdAt: new Date().toISOString(),
  })

  it('filters notes only', () => {
    const notes = { [prKey('acme/a', 1)]: 'deploy sql' }
    const result = filterPullRequests(
      [old, fresh],
      { query: '', notesOnly: true, conflictOnly: false, minOpenDays: 0 },
      notes,
    )
    expect(result.map((p) => p.number)).toEqual([1])
  })

  it('filters conflict only', () => {
    const result = filterPullRequests(
      [old, fresh],
      { query: '', notesOnly: false, conflictOnly: true, minOpenDays: 0 },
      {},
    )
    expect(result).toHaveLength(1)
    expect(result[0]?.mergeable).toBe('CONFLICTING')
  })

  it('filters open age', () => {
    const result = filterPullRequests(
      [old, fresh],
      { query: '', notesOnly: false, conflictOnly: false, minOpenDays: 30 },
      {},
    )
    expect(result.map((p) => p.number)).toEqual([1])
  })
})

describe('sortPinnedFirst', () => {
  it('keeps relative order and pins first', () => {
    const a = pr({ repo: 'r', number: 1, title: 'a' })
    const b = pr({ repo: 'r', number: 2, title: 'b' })
    const c = pr({ repo: 'r', number: 3, title: 'c' })
    const pins = new Set([prKey('r', 3), prKey('r', 1)])
    expect(sortPinnedFirst([a, b, c], pins).map((p) => p.number)).toEqual([1, 3, 2])
  })
})
