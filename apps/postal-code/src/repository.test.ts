import { describe, expect, it, vi } from 'vitest'

import { communeQuery, createPostalRepository, pointQuery } from './repository.js'

const row = { available: true, matches: [{ code: '96001', label: 'VILLE FICTIVE' }] }

describe('postal repository', () => {
  it('parameterizes commune selection and preserves paired references', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row] })
    const result = await createPostalRepository({ query })({ inseeCom: '96001' })
    expect(query).toHaveBeenCalledWith(communeQuery, ['96001'])
    expect(result).toEqual(row)
  })

  it('parameterizes WGS84 coordinates and the optional commune filter', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row] })
    const read = createPostalRepository({ query })
    await read({ position: { long: 2.5, lat: 46 } })
    expect(query).toHaveBeenLastCalledWith(pointQuery, [null, 2.5, 46])
    await read({ inseeCom: '96001', position: { long: 2.5, lat: 46 } })
    expect(query).toHaveBeenLastCalledWith(pointQuery, ['96001', 2.5, 46])
    expect(pointQuery).toContain('ST_Transform')
    expect(pointQuery).toContain('ST_Contains')
    expect(pointQuery).not.toContain('ST_Buffer')
    expect(pointQuery).toContain('ORDER BY code, label LIMIT 2')
    expect(pointQuery).not.toContain('->>')
    expect(communeQuery).not.toContain('->>')
  })

  it('never interpolates parameter values into SQL', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [row] })
    const malicious = "96001'; SELECT private_data; --"
    await createPostalRepository({ query })({ inseeCom: malicious })
    expect(query).toHaveBeenCalledWith(communeQuery, [malicious])
    expect(communeQuery).not.toContain(malicious)
  })

  it.each([
    [], [{}], [{ available: 'true', matches: [] }], [{ available: true, matches: null }],
    [{ available: true, matches: [{ code: 'bad', label: 'FICTIF' }] }],
    [{ available: true, matches: [{ code: '96001\n', label: 'FICTIF' }] }],
    [{ available: true, matches: [{ code: '96001', label: {} }] }],
    [{ available: true, matches: [{ code: '96001', label: 42 }] }],
  ].map(rows => ({ rows })))('rejects corrupt reference responses %#', async ({ rows }) => {
    const query = vi.fn().mockResolvedValue({ rows })
    await expect(createPostalRepository({ query })({ inseeCom: '96001' }))
      .rejects.toThrow('Invalid postal reference response')
  })

  it('propagates SQL failure to the handler error boundary', async () => {
    const query = vi.fn().mockRejectedValue(new Error('private SQL diagnostic'))
    await expect(createPostalRepository({ query })({ inseeCom: '96001' }))
      .rejects.toThrow('private SQL diagnostic')
  })
})
