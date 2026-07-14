import { describe, expect, it } from 'vitest'
import { parseBackupJson } from './backup'
import { normalizeLayout } from './repoLayout'

describe('parseBackupJson', () => {
  it('parses a valid v1 backup', () => {
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
    expect(() => parseBackupJson(JSON.stringify({ version: 99 }))).toThrow(/version/)
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
