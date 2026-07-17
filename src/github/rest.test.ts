import { describe, expect, it } from 'vitest'
import { parseLinkNext } from './rest'

describe('parseLinkNext', () => {
  it('returns null when missing', () => {
    expect(parseLinkNext(null)).toBeNull()
    expect(parseLinkNext('')).toBeNull()
  })

  it('extracts rel=next URL', () => {
    const link =
      '<https://api.github.com/repos/a/b/branches?page=2>; rel="next", ' +
      '<https://api.github.com/repos/a/b/branches?page=1>; rel="prev"'
    expect(parseLinkNext(link)).toBe('https://api.github.com/repos/a/b/branches?page=2')
  })
})
