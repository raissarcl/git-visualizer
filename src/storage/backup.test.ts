import { describe, expect, it } from 'vitest'
import { parseBackupJson } from './backup'

describe('parseBackupJson', () => {
  it('parses a valid v1 backup', () => {
    const raw = JSON.stringify({
      version: 1,
      exportedAt: '2026-07-14T12:00:00.000Z',
      notes: { 'acme/api#1': 'run migration' },
      pins: ['acme/api#1'],
      repoLayout: { folders: [], folderByRepo: {}, hidden: [] },
      sidebarCollapsed: true,
    })

    const data = parseBackupJson(raw)
    expect(data.notes['acme/api#1']).toBe('run migration')
    expect(data.pins.has('acme/api#1')).toBe(true)
    expect(data.sidebarCollapsed).toBe(true)
  })

  it('rejects invalid JSON', () => {
    expect(() => parseBackupJson('{')).toThrow(/JSON inválido/)
  })

  it('rejects wrong version', () => {
    expect(() => parseBackupJson(JSON.stringify({ version: 99 }))).toThrow(/version/)
  })
})
