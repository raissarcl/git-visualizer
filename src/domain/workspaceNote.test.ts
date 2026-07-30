import { describe, expect, it } from 'vitest'
import {
  createWorkspaceNote,
  filterWorkspaceNotes,
  findMatchingPr,
  normalizeTags,
  noteBodyPreview,
  noteListTitle,
  sortWorkspaceNotes,
  type WorkspaceNote,
} from './workspaceNote'

function note(partial: Partial<WorkspaceNote> & Pick<WorkspaceNote, 'id'>): WorkspaceNote {
  return createWorkspaceNote(partial)
}

describe('sortWorkspaceNotes', () => {
  it('puts pins first then updatedAt desc', () => {
    const list = [
      note({ id: '1', pinned: false, updatedAt: '2026-01-02T00:00:00.000Z' }),
      note({ id: '2', pinned: true, updatedAt: '2026-01-01T00:00:00.000Z' }),
      note({ id: '3', pinned: false, updatedAt: '2026-01-03T00:00:00.000Z' }),
    ]
    expect(sortWorkspaceNotes(list).map((n) => n.id)).toEqual(['2', '3', '1'])
  })
})

describe('filterWorkspaceNotes', () => {
  const list = [
    note({
      id: 'g',
      title: 'Ideia geral',
      link: { type: 'none' },
      tags: ['ideia'],
    }),
    note({
      id: 'r',
      title: 'Deploy api',
      link: { type: 'repo', repo: 'acme/api' },
      tags: ['deploy'],
    }),
    note({
      id: 'b',
      title: 'WIP feature',
      body: 'ainda local',
      link: {
        type: 'branch',
        repo: 'acme/api',
        branch: 'feat/x',
        remoteStatus: 'manual',
      },
      pinned: true,
    }),
    note({
      id: 'arch',
      title: 'Velha',
      status: 'archived',
      link: { type: 'repo', repo: 'acme/web' },
    }),
  ]

  const filters = {
    query: '',
    status: 'all' as const,
    pinnedOnly: false,
    tag: '',
    linkType: 'all' as const,
    unverifiedOnly: false,
    excludeGeneral: false,
  }

  it('filters by network scope (all)', () => {
    expect(
      filterWorkspaceNotes(list, filters, { type: 'network' }),
    ).toHaveLength(4)
  })

  it('filters by repo scope including gerais', () => {
    const result = filterWorkspaceNotes(list, filters, {
      type: 'repos',
      repos: ['acme/api'],
      excludeGeneral: false,
    })
    expect(result.map((n) => n.id).sort()).toEqual(['b', 'g', 'r'])
  })

  it('can exclude gerais no escopo', () => {
    const result = filterWorkspaceNotes(
      list,
      { ...filters, excludeGeneral: true },
      { type: 'repos', repos: ['acme/api'], excludeGeneral: true },
    )
    expect(result.map((n) => n.id).sort()).toEqual(['b', 'r'])
  })

  it('filters unverified branches and status', () => {
    expect(
      filterWorkspaceNotes(
        list,
        { ...filters, unverifiedOnly: true, status: 'open' },
        { type: 'network' },
      ).map((n) => n.id),
    ).toEqual(['b'])
  })

  it('filters by query and tag', () => {
    expect(
      filterWorkspaceNotes(
        list,
        { ...filters, query: 'local' },
        { type: 'network' },
      ).map((n) => n.id),
    ).toEqual(['b'])
    expect(
      filterWorkspaceNotes(
        list,
        { ...filters, tag: 'ideia' },
        { type: 'network' },
      ).map((n) => n.id),
    ).toEqual(['g'])
  })
})

describe('findMatchingPr', () => {
  it('matches open PR by head branch', () => {
    const n = note({
      id: '1',
      link: {
        type: 'branch',
        repo: 'acme/api',
        branch: 'feat/x',
        remoteStatus: 'verified',
      },
    })
    expect(
      findMatchingPr(n, [
        { repo: 'acme/api', number: 9, headRefName: 'feat/x', state: 'OPEN' },
      ]),
    ).toEqual({ repo: 'acme/api', number: 9 })
    expect(
      findMatchingPr(n, [
        { repo: 'acme/api', number: 9, headRefName: 'feat/x', state: 'MERGED' },
      ]),
    ).toBeNull()
  })
})

describe('normalizeTags', () => {
  it('trims and dedupes case-insensitively', () => {
    expect(normalizeTags(['  WIP ', 'wip', 'deploy', ''])).toEqual(['WIP', 'deploy'])
  })
})

describe('noteListTitle / noteBodyPreview', () => {
  it('uses body preview when title is empty', () => {
    const n = note({
      id: '1',
      title: '',
      body: '## Hello\n\nworld of **notes**',
    })
    expect(noteBodyPreview(n)).toBe('Hello world of notes')
    expect(noteListTitle(n)).toBe('Hello world of notes')
  })

  it('keeps title when present', () => {
    const n = note({ id: '1', title: 'My note', body: 'body text here' })
    expect(noteListTitle(n)).toBe('My note')
    expect(noteBodyPreview(n, 20)).toMatch(/body text/)
  })
})
