import { describe, expect, it } from 'vitest'
import {
  addRepoToFolder,
  applyRepoOrder,
  buildSidebarTree,
  collectSubtreeIds,
  createFolder,
  deleteFolder,
  emptyLayout,
  moveFolder,
  moveRepo,
  normalizeLayout,
  removeRepoFromFolder,
  reorderReposInFolder,
  reposInFolder,
  reposForScope,
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
    expect(layout.repoOrderByFolder[rootId]).toEqual(['acme/api'])
    expect(layout.repoOrderByFolder[childId]).toEqual(['acme/api', 'acme/web'])
    // Pasta pai inclui repos só da subpasta
    expect(
      reposInFolder(layout, rootId, ['acme/api', 'acme/web', 'acme/cli']),
    ).toEqual(['acme/api', 'acme/web'])
    expect(reposInFolder(layout, childId, ['acme/api', 'acme/web'])).toEqual([
      'acme/api',
      'acme/web',
    ])
  })

  it('reposForScope resolves repo, folder subtree, and network fallback', () => {
    let layout = emptyLayout()
    layout = createFolder(layout, 'Work')
    const rootId = layout.folders[0].id
    layout = addRepoToFolder(layout, 'acme/api', rootId)
    layout = addRepoToFolder(layout, 'acme/web', rootId)
    const all = ['acme/api', 'acme/web', 'acme/cli']

    expect(
      reposForScope({ type: 'repo', name: 'acme/cli' }, layout, all),
    ).toEqual(['acme/cli'])
    expect(reposForScope({ type: 'folder', id: rootId }, layout, all)).toEqual([
      'acme/api',
      'acme/web',
    ])
    expect(reposForScope({ type: 'network' }, layout, all, 'empty')).toEqual([])
    expect(reposForScope({ type: 'network' }, layout, all, 'all')).toEqual(all)
  })

  it('deleteFolder removes subtree, memberships, and repo order', () => {
    let layout = emptyLayout()
    layout = createFolder(layout, 'Work')
    const rootId = layout.folders[0].id
    layout = createFolder(layout, 'Backend', rootId)
    const childId = layout.folders[1].id
    layout = addRepoToFolder(layout, 'acme/api', childId)

    expect(collectSubtreeIds(layout, rootId)).toEqual(
      new Set([rootId, childId]),
    )

    layout = deleteFolder(layout, rootId)
    expect(layout.folders).toHaveLength(0)
    expect(layout.foldersByRepo['acme/api']).toBeUndefined()
    expect(layout.repoOrderByFolder[childId]).toBeUndefined()
  })

  it('removeRepoFromFolder only clears that folder', () => {
    let layout = normalizeLayout({
      folders: [
        { id: 'a', name: 'A', parentId: null },
        { id: 'b', name: 'B', parentId: null },
      ],
      foldersByRepo: { 'acme/api': ['a', 'b'] },
      hidden: [],
      repoOrderByFolder: { a: ['acme/api'], b: ['acme/api'] },
    })

    layout = removeRepoFromFolder(layout, 'acme/api', 'a')
    expect(layout.foldersByRepo['acme/api']).toEqual(['b'])
    expect(layout.repoOrderByFolder.a).toBeUndefined()
    expect(layout.repoOrderByFolder.b).toEqual(['acme/api'])
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
    // Sem ordem customizada: fallback alfabético
    expect(tree.uncategorized).toEqual(['acme/cli', 'acme/web'])
  })

  it('moveFolder reorders siblings', () => {
    let layout = normalizeLayout({
      folders: [
        { id: 'a', name: 'A', parentId: null },
        { id: 'b', name: 'B', parentId: null },
        { id: 'c', name: 'C', parentId: null },
      ],
      foldersByRepo: {},
      hidden: [],
    })

    layout = moveFolder(layout, 'c', null, 0)
    expect(
      layout.folders.filter((f) => f.parentId === null).map((f) => f.id),
    ).toEqual(['c', 'a', 'b'])

    layout = moveFolder(layout, 'a', null, 2)
    expect(
      layout.folders.filter((f) => f.parentId === null).map((f) => f.id),
    ).toEqual(['c', 'b', 'a'])
  })

  it('moveFolder reparents and rejects cycles', () => {
    let layout = normalizeLayout({
      folders: [
        { id: 'a', name: 'A', parentId: null },
        { id: 'b', name: 'B', parentId: 'a' },
        { id: 'c', name: 'C', parentId: null },
      ],
      foldersByRepo: {},
      hidden: [],
    })

    const unchanged = moveFolder(layout, 'a', 'b', 0)
    expect(unchanged).toBe(layout)

    layout = moveFolder(layout, 'c', 'a', 0)
    expect(layout.folders.find((f) => f.id === 'c')?.parentId).toBe('a')
    expect(
      layout.folders.filter((f) => f.parentId === 'a').map((f) => f.id),
    ).toEqual(['c', 'b'])
  })

  it('applyRepoOrder and buildSidebarTree respect custom order', () => {
    expect(applyRepoOrder(['a', 'b', 'c'], ['c', 'a'])).toEqual(['c', 'a', 'b'])

    const layout = normalizeLayout({
      folders: [{ id: 'f', name: 'F', parentId: null }],
      foldersByRepo: {
        'acme/z': ['f'],
        'acme/a': ['f'],
        'acme/m': ['f'],
      },
      repoOrderByFolder: { f: ['acme/z', 'acme/a'] },
      uncategorizedOrder: ['acme/cli', 'acme/web'],
      hidden: [],
    })

    const tree = buildSidebarTree(
      ['acme/a', 'acme/m', 'acme/z', 'acme/web', 'acme/cli'],
      layout,
    )
    expect(tree.roots[0].repos).toEqual(['acme/z', 'acme/a', 'acme/m'])
    expect(tree.uncategorized).toEqual(['acme/cli', 'acme/web'])
  })

  it('reorderReposInFolder and moveRepo update membership and order', () => {
    let layout = normalizeLayout({
      folders: [
        { id: 'a', name: 'A', parentId: null },
        { id: 'b', name: 'B', parentId: null },
      ],
      foldersByRepo: {
        'acme/api': ['a'],
        'acme/web': ['a'],
      },
      repoOrderByFolder: { a: ['acme/api', 'acme/web'] },
      hidden: [],
    })

    layout = reorderReposInFolder(layout, 'a', ['acme/web', 'acme/api'])
    expect(layout.repoOrderByFolder.a).toEqual(['acme/web', 'acme/api'])

    layout = moveRepo(layout, 'acme/web', 'a', 'b', 0)
    expect(layout.foldersByRepo['acme/web']).toEqual(['b'])
    expect(layout.repoOrderByFolder.a).toEqual(['acme/api'])
    expect(layout.repoOrderByFolder.b).toEqual(['acme/web'])

    layout = moveRepo(layout, 'acme/web', 'b', null, 0)
    expect(layout.foldersByRepo['acme/web']).toBeUndefined()
    expect(layout.uncategorizedOrder).toEqual(['acme/web'])
  })

  it('normalizeLayout accepts order fields and drops invalid folder keys', () => {
    const layout = normalizeLayout({
      folders: [{ id: 'f1', name: 'F', parentId: null }],
      foldersByRepo: {},
      repoOrderByFolder: {
        f1: ['acme/a', 'acme/a'],
        gone: ['acme/x'],
      },
      uncategorizedOrder: ['acme/z', 'acme/z', 1],
      hidden: [],
    })

    expect(layout.repoOrderByFolder).toEqual({ f1: ['acme/a'] })
    expect(layout.uncategorizedOrder).toEqual(['acme/z'])
    expect(layout.repoOrderByFolder.gone).toBeUndefined()
  })
})
