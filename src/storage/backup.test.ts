import { describe, expect, it, beforeEach, vi } from 'vitest'
import {
  applyImportedData,
  buildLocalBackup,
  clearLocalData,
  parseBackupJson,
} from './backup'
import { loadNotes } from './notes'
import { loadPins } from './pins'
import { loadSidebarCollapsed } from './preferences'
import { emptyLayout, loadRepoLayout, normalizeLayout } from './repoLayout'
import { loadWorkspaceNotes } from './workspaceNotes'

function mockLocalStorage() {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  })
}

describe('parseBackupJson', () => {
  it('parses a valid v1 backup with empty workspaceNotes', () => {
    const raw = JSON.stringify({
      version: 1,
      exportedAt: '2026-07-14T12:00:00.000Z',
      notes: { 'acme/api#1': 'run migration' },
      pins: ['acme/api#1'],
      repoLayout: { folders: [], foldersByRepo: {}, hidden: [] },
      sidebarCollapsed: true,
    })

    const data = parseBackupJson(raw)
    expect(data.notes['acme/api#1']).toBe('run migration')
    expect(data.pins.has('acme/api#1')).toBe(true)
    expect(data.sidebarCollapsed).toBe(true)
    expect(data.repoLayout.foldersByRepo).toEqual({})
    expect(data.workspaceNotes).toEqual([])
  })

  it('parses a valid v2 backup with workspaceNotes', () => {
    const raw = JSON.stringify({
      version: 2,
      exportedAt: '2026-07-30T12:00:00.000Z',
      notes: {},
      pins: [],
      repoLayout: { folders: [], foldersByRepo: {}, hidden: [] },
      sidebarCollapsed: false,
      workspaceNotes: [
        {
          id: 'n1',
          title: 'Scratch',
          body: 'hello',
          status: 'open',
          pinned: false,
          tags: [],
          createdAt: '2026-07-30T00:00:00.000Z',
          updatedAt: '2026-07-30T00:00:00.000Z',
          link: { type: 'none' },
        },
      ],
    })

    const data = parseBackupJson(raw)
    expect(data.workspaceNotes).toHaveLength(1)
    expect(data.workspaceNotes[0]?.title).toBe('Scratch')
  })

  it('migrates legacy folderByRepo on import', () => {
    const raw = JSON.stringify({
      version: 1,
      exportedAt: '2026-07-14T12:00:00.000Z',
      notes: {},
      pins: [],
      repoLayout: {
        folders: [{ id: 'f1', name: 'Work' }],
        folderByRepo: { 'acme/api': 'f1', 'acme/web': null },
        hidden: [],
      },
      sidebarCollapsed: false,
    })

    const data = parseBackupJson(raw)
    expect(data.repoLayout.folders[0]).toMatchObject({
      id: 'f1',
      name: 'Work',
      parentId: null,
    })
    expect(data.repoLayout.foldersByRepo).toEqual({ 'acme/api': ['f1'] })
  })

  it('rejects invalid JSON', () => {
    expect(() => parseBackupJson('{')).toThrow(/JSON inválido/)
  })

  it('rejects wrong version', () => {
    expect(() => parseBackupJson(JSON.stringify({ version: 99 }))).toThrow(
      /version/,
    )
  })
})

describe('clearLocalData', () => {
  beforeEach(() => {
    mockLocalStorage()
  })

  it('wipes notes, pins, layout, workspace notes and sidebar without touching token', () => {
    localStorage.setItem('gh_pat', 'ghp_secret')
    applyImportedData({
      notes: { 'acme/api#1': 'note' },
      pins: new Set(['acme/api#1']),
      repoLayout: {
        folders: [{ id: 'f1', name: 'Work', parentId: null }],
        foldersByRepo: { 'acme/api': ['f1'] },
        hidden: ['acme/legacy'],
      },
      sidebarCollapsed: true,
      workspaceNotes: [
        {
          id: 'n1',
          title: 'x',
          body: '',
          status: 'open',
          pinned: false,
          tags: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
          link: { type: 'none' },
        },
      ],
    })

    const cleared = clearLocalData()

    expect(cleared.notes).toEqual({})
    expect(cleared.pins.size).toBe(0)
    expect(cleared.repoLayout).toEqual(emptyLayout())
    expect(cleared.sidebarCollapsed).toBe(false)
    expect(cleared.workspaceNotes).toEqual([])
    expect(loadNotes()).toEqual({})
    expect(loadPins().size).toBe(0)
    expect(loadRepoLayout()).toEqual(emptyLayout())
    expect(loadSidebarCollapsed()).toBe(false)
    expect(loadWorkspaceNotes()).toEqual([])
    expect(localStorage.getItem('gh_pat')).toBe('ghp_secret')
    expect(buildLocalBackup().pins).toEqual([])
    expect(buildLocalBackup().version).toBe(2)
    expect(buildLocalBackup().workspaceNotes).toEqual([])
  })
})

describe('normalizeLayout', () => {
  it('supports nested folders and multi-membership', () => {
    const layout = normalizeLayout({
      folders: [
        { id: 'root', name: 'Root', parentId: null },
        { id: 'child', name: 'Child', parentId: 'root' },
      ],
      foldersByRepo: {
        'acme/api': ['root', 'child'],
      },
      hidden: [],
    })

    expect(layout.folders.find((f) => f.id === 'child')?.parentId).toBe('root')
    expect(layout.foldersByRepo['acme/api']).toEqual(['root', 'child'])
  })
})
