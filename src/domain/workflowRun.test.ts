import { describe, expect, it } from 'vitest'
import {
  actionNoteKey,
  canCancel,
  canRerun,
  canRerunFailed,
  filterWorkflowRuns,
  isBranchLikeInput,
  mergeWorkflowRunDetail,
  runBadgeKind,
  runKey,
  sortRunsByCreatedDesc,
  sortRunsFailedFirst,
  type WorkflowRun,
} from './workflowRun'

function run(
  partial: Partial<WorkflowRun> & Pick<WorkflowRun, 'id' | 'repo'>,
): WorkflowRun {
  return {
    id: partial.id,
    databaseId: String(partial.id),
    name: partial.name ?? 'CI',
    displayTitle: partial.displayTitle ?? 'CI run',
    status: partial.status ?? 'completed',
    conclusion: partial.conclusion ?? 'success',
    htmlUrl: partial.htmlUrl ?? 'https://example.com',
    repo: partial.repo,
    headBranch: partial.headBranch ?? 'main',
    headSha: partial.headSha ?? 'abc123def456',
    event: partial.event ?? 'push',
    actorLogin: partial.actorLogin ?? 'alice',
    createdAt: partial.createdAt ?? '2026-01-02T00:00:00Z',
    updatedAt: partial.updatedAt ?? '2026-01-02T01:00:00Z',
    runNumber: partial.runNumber ?? 1,
    workflowId: partial.workflowId ?? 10,
    workflowPath: partial.workflowPath ?? '.github/workflows/ci.yml',
    inputs: partial.inputs ?? {},
  }
}

describe('runKey / actionNoteKey', () => {
  it('formats repo#id', () => {
    expect(runKey('acme/api', 99)).toBe('acme/api#99')
  })

  it('prefixes note keys to avoid PR collisions', () => {
    expect(actionNoteKey('acme/api', 99)).toBe('run:acme/api#99')
  })
})

describe('mergeWorkflowRunDetail', () => {
  it('keeps previous inputs when list omits them', () => {
    const previous = run({
      id: 1,
      repo: 'acme/api',
      inputs: { environment: 'prod', ref: 'release/1' },
      headSha: 'deadbeef',
    })
    const fromList = run({
      id: 1,
      repo: 'acme/api',
      inputs: {},
      headSha: '',
      headBranch: 'main',
    })
    expect(mergeWorkflowRunDetail(fromList, previous).inputs).toEqual({
      environment: 'prod',
      ref: 'release/1',
    })
    expect(mergeWorkflowRunDetail(fromList, previous).headSha).toBe('deadbeef')
  })
})

describe('canCancel / canRerun / canRerunFailed', () => {
  it('allows cancel only while in progress', () => {
    expect(canCancel(run({ id: 1, repo: 'a/b', status: 'in_progress', conclusion: null }))).toBe(
      true,
    )
    expect(canCancel(run({ id: 1, repo: 'a/b', status: 'completed', conclusion: 'success' }))).toBe(
      false,
    )
  })

  it('allows rerun when completed', () => {
    expect(canRerun(run({ id: 1, repo: 'a/b', status: 'completed', conclusion: 'failure' }))).toBe(
      true,
    )
    expect(canRerun(run({ id: 1, repo: 'a/b', status: 'queued', conclusion: null }))).toBe(false)
  })

  it('allows rerun failed only on failure-like conclusions', () => {
    expect(
      canRerunFailed(run({ id: 1, repo: 'a/b', status: 'completed', conclusion: 'failure' })),
    ).toBe(true)
    expect(
      canRerunFailed(run({ id: 1, repo: 'a/b', status: 'completed', conclusion: 'success' })),
    ).toBe(false)
  })
})

describe('runBadgeKind', () => {
  it('maps status and conclusion', () => {
    expect(runBadgeKind(run({ id: 1, repo: 'a/b', status: 'queued', conclusion: null }))).toBe(
      'queued',
    )
    expect(
      runBadgeKind(run({ id: 1, repo: 'a/b', status: 'in_progress', conclusion: null })),
    ).toBe('in_progress')
    expect(
      runBadgeKind(run({ id: 1, repo: 'a/b', status: 'completed', conclusion: 'success' })),
    ).toBe('success')
    expect(
      runBadgeKind(run({ id: 1, repo: 'a/b', status: 'completed', conclusion: 'failure' })),
    ).toBe('failure')
  })
})

describe('filterWorkflowRuns', () => {
  const list = [
    run({
      id: 1,
      repo: 'acme/a',
      displayTitle: 'Build app',
      status: 'completed',
      conclusion: 'failure',
    }),
    run({
      id: 2,
      repo: 'acme/b',
      displayTitle: 'Deploy',
      status: 'in_progress',
      conclusion: null,
      actorLogin: 'bob',
    }),
    run({
      id: 3,
      repo: 'acme/a',
      displayTitle: 'Lint',
      status: 'completed',
      conclusion: 'success',
    }),
  ]

  it('filters by status', () => {
    expect(
      filterWorkflowRuns(list, { query: '', status: 'failure', withinDays: 0 }),
    ).toHaveLength(1)
    expect(
      filterWorkflowRuns(list, { query: '', status: 'in_progress', withinDays: 0 }),
    ).toHaveLength(1)
    expect(
      filterWorkflowRuns(list, { query: '', status: 'success', withinDays: 0 }),
    ).toHaveLength(1)
  })

  it('filters by query', () => {
    expect(
      filterWorkflowRuns(list, { query: 'bob', status: 'all', withinDays: 0 }),
    ).toHaveLength(1)
    expect(
      filterWorkflowRuns(list, { query: 'acme/a', status: 'all', withinDays: 0 }),
    ).toHaveLength(2)
  })

  it('filters by withinDays on createdAt', () => {
    const recent = run({
      id: 10,
      repo: 'acme/a',
      createdAt: new Date().toISOString(),
    })
    const stale = run({
      id: 11,
      repo: 'acme/a',
      createdAt: '2020-01-01T00:00:00Z',
    })
    expect(
      filterWorkflowRuns([recent, stale], {
        query: '',
        status: 'all',
        withinDays: 7,
      }).map((r) => r.id),
    ).toEqual([10])
  })
})

describe('sort helpers', () => {
  it('sorts failed first', () => {
    const list = [
      run({ id: 1, repo: 'a/b', conclusion: 'success' }),
      run({ id: 2, repo: 'a/b', conclusion: 'failure' }),
      run({ id: 3, repo: 'a/b', conclusion: 'success' }),
    ]
    expect(sortRunsFailedFirst(list).map((r) => r.id)).toEqual([2, 1, 3])
  })

  it('sorts by createdAt desc', () => {
    const list = [
      run({ id: 1, repo: 'a/b', createdAt: '2026-01-01T00:00:00Z' }),
      run({ id: 2, repo: 'a/b', createdAt: '2026-01-03T00:00:00Z' }),
      run({ id: 3, repo: 'a/b', createdAt: '2026-01-02T00:00:00Z' }),
    ]
    expect(sortRunsByCreatedDesc(list).map((r) => r.id)).toEqual([2, 3, 1])
  })
})

describe('isBranchLikeInput', () => {
  it('detects branch/deploy/ref string inputs', () => {
    expect(
      isBranchLikeInput({ name: 'deploy_branch', type: 'string', options: [] }),
    ).toBe(true)
    expect(isBranchLikeInput({ name: 'target-branch', type: 'string', options: [] })).toBe(true)
    expect(isBranchLikeInput({ name: 'ref', type: 'string', options: [] })).toBe(true)
    expect(isBranchLikeInput({ name: 'git_ref', type: 'environment', options: [] })).toBe(true)
  })

  it('ignores boolean, number, and choice with options', () => {
    expect(isBranchLikeInput({ name: 'branch', type: 'boolean', options: [] })).toBe(false)
    expect(isBranchLikeInput({ name: 'branch', type: 'number', options: [] })).toBe(false)
    expect(
      isBranchLikeInput({ name: 'branch', type: 'choice', options: ['a', 'b'] }),
    ).toBe(false)
  })

  it('ignores unrelated string inputs', () => {
    expect(isBranchLikeInput({ name: 'environment', type: 'string', options: [] })).toBe(false)
    expect(isBranchLikeInput({ name: 'note', type: 'string', options: [] })).toBe(false)
  })
})
