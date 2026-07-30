import { describe, expect, it } from 'vitest'
import { parseWorkspaceNotes } from './workspaceNotes'

describe('parseWorkspaceNotes', () => {
  it('parses valid notes and drops invalid', () => {
    const notes = parseWorkspaceNotes([
      {
        id: 'a',
        title: 'Hello',
        body: 'world',
        status: 'open',
        pinned: true,
        tags: ['wip'],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
        link: {
          type: 'branch',
          repo: 'acme/api',
          branch: 'feat/x',
          remoteStatus: 'manual',
        },
      },
      { title: 'sem id' },
      null,
      {
        id: 'a',
        title: 'dup',
        body: '',
        link: { type: 'none' },
      },
    ])

    expect(notes).toHaveLength(1)
    expect(notes[0]).toMatchObject({
      id: 'a',
      title: 'Hello',
      pinned: true,
      link: {
        type: 'branch',
        repo: 'acme/api',
        branch: 'feat/x',
        remoteStatus: 'manual',
      },
    })
  })
})
