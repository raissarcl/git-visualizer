import { describe, expect, it } from 'vitest'
import {
  addRepoToFolder,
  buildSidebarTree,
  collectSubtreeIds,
  createFolder,
  deleteFolder,
  emptyLayout,
  normalizeLayout,
  removeRepoFromFolder,
  reposInFolder,
} from './repoLayout'

describe('repoLayout', () => {
  it('creates nested folders and multi-membership', () => {
    let layout = emptyLayout()
    layout = createFolder(layout, 'Work')
    const rootId = layout.folders[0].id
    layout = createFolder(layout, 'Backend', rootId)
    const childId = layout.folders[1].id

    layout = addRepoToFolder(layout, 'acme/api', rootId)
    layout = addRepoToFolder(layout, 'acme/api', childId)
    layout = addRepoToFolder(layout, 'acme/web', childId)

    expect(layout.foldersByRepo['acme/api']).toEqual([rootId, childId])
    // Pasta pai inclui repos só da subpasta
    expect(reposInFolder(layout, rootId, ['acme/api', 'acme/web', 'acme/cli'])).toEqual([
      'acme/api',
      'acme/web',
    ])
    expect(reposInFolder(layout, childId, ['acme/api', 'acme/web'])).toEqual([
      'acme/api',
      'acme/web',
    ])
  })

  it('deleteFolder removes subtree and memberships', () => {
    let layout = emptyLayout()
    layout = createFolder(layout, 'Work')
    const rootId = layout.folders[0].id
    layout = createFolder(layout, 'Backend', rootId)
    const childId = layout.folders[1].id
    layout = addRepoToFolder(layout, 'acme/api', childId)

    expect(collectSubtreeIds(layout, rootId)).toEqual(new Set([rootId, childId]))

    layout = deleteFolder(layout, rootId)
    expect(layout.folders).toHaveLength(0)
    expect(layout.foldersByRepo['acme/api']).toBeUndefined()
  })

  it('removeRepoFromFolder only clears that folder', () => {
    let layout = normalizeLayout({
      folders: [
        { id: 'a', name: 'A', parentId: null },
        { id: 'b', name: 'B', parentId: null },
      ],
      foldersByRepo: { 'acme/api': ['a', 'b'] },
      hidden: [],
    })

    layout = removeRepoFromFolder(layout, 'acme/api', 'a')
    expect(layout.foldersByRepo['acme/api']).toEqual(['b'])
  })

  it('buildSidebarTree nests children and lists uncategorized', () => {
    const layout = normalizeLayout({
      folders: [
        { id: 'a', name: 'A', parentId: null },
        { id: 'b', name: 'B', parentId: 'a' },
      ],
      foldersByRepo: {
        'acme/api': ['b'],
        'acme/web': [],
      },
      hidden: [],
    })

    const tree = buildSidebarTree(['acme/api', 'acme/web', 'acme/cli'], layout)
    expect(tree.roots).toHaveLength(1)
    expect(tree.roots[0].children[0].folder.id).toBe('b')
    expect(tree.roots[0].children[0].repos).toEqual(['acme/api'])
    expect(tree.uncategorized).toEqual(['acme/web', 'acme/cli'])
  })
})
