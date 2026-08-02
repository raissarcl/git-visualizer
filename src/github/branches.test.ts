import { describe, expect, it, vi } from 'vitest'
import { checkRepoBranch } from './branches'

describe('checkRepoBranch', () => {
  it('returns verified on 200 and missing on 404', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ name: 'feat/x' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => '',
      })

    vi.stubGlobal('fetch', fetchMock)

    await expect(checkRepoBranch('tok', 'acme/api', 'feat/x')).resolves.toBe(
      'verified',
    )
    await expect(checkRepoBranch('tok', 'acme/api', 'ghost')).resolves.toBe(
      'missing',
    )

    expect(fetchMock.mock.calls[0]![0]).toContain(
      '/repos/acme/api/branches/feat%2Fx',
    )
  })
})
