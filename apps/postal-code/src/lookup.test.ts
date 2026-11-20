import { describe, expect, it, vi } from 'vitest'

import { createPostalLookup, parsePostalInput } from './lookup.js'
import type { PostalInput, PostalSnapshot } from './lookup.js'

const mono = { code: '96001', label: 'VILLE FICTIVE' }
const input = { inseeCom: '96001' }
const snapshot = (matches = [mono]): PostalSnapshot => ({ available: true, matches })

describe('postal input', () => {
  it('accepts a commune, WGS84 position, and both together without coercion', () => {
    expect(parsePostalInput(input)).toEqual(input)
    expect(parsePostalInput({ inseeCom: '2A123', long: '2.5', lat: '46' }))
      .toEqual({ inseeCom: '2A123', position: { long: 2.5, lat: 46 } })
    expect(parsePostalInput({ long: '-180', lat: '90' }))
      .toEqual({ position: { long: -180, lat: 90 } })
  })

  it.each([
    {}, { inseeCom: '' }, { inseeCom: ['96001'] }, { inseeCom: 'AAAAA' },
    { inseeCom: '96001\n' }, { inseeCom: '96001', extra: 'ignored' },
    { inseeCom: '96001', long: '2' }, { lat: '45' },
    { long: '181', lat: '0' }, { long: '0', lat: '-91' },
    { long: 'NaN', lat: '0' }, { long: 'Infinity', lat: '0' },
    { long: '1e2', lat: '0' }, { long: '2 ', lat: '0' },
    { long: '2\n', lat: '0' }, { long: 2, lat: 45 },
    { long: ['2'], lat: '45' }, { long: { x: '2' }, lat: '45' },
  ])('rejects invalid or partial parameters %#', query => {
    expect(() => parsePostalInput(query)).toThrow('Invalid postal lookup parameters')
  })
})

describe('postal lookup', () => {
  it('returns the historical single code with its paired label extensions', async () => {
    const read = vi.fn().mockResolvedValue(snapshot())
    expect(await createPostalLookup(read)(input)).toEqual({
      code_postal: '96001',
      libelle_acheminement: 'VILLE FICTIVE',
      libelles_acheminement: { '96001': 'VILLE FICTIVE' },
    })
    expect(read).toHaveBeenCalledWith(input)
  })

  it('sorts and deduplicates commune codes with correctly paired labels', async () => {
    const resolve = createPostalLookup(async () => snapshot([
      { code: '96002', label: 'SECTEUR FICTIF' }, mono, mono,
    ]))
    expect(await resolve(input)).toEqual({
      code_postal: ['96001', '96002'],
      libelle_acheminement: null,
      libelles_acheminement: { '96001': 'VILLE FICTIVE', '96002': 'SECTEUR FICTIF' },
    })
  })

  it('distinguishes absent commune or point from unloaded references', async () => {
    await expect(createPostalLookup(async () => snapshot([]))(input))
      .rejects.toMatchObject({ status: 404 })
    await expect(createPostalLookup(async () => ({ available: false, matches: [] }))(input))
      .rejects.toMatchObject({ status: 503 })
  })

  it('does not choose between overlapping contours or conflicting delivery labels', async () => {
    const positioned: PostalInput = { position: { long: 2, lat: 46 } }
    await expect(createPostalLookup(async () => snapshot([
      mono, { code: '96002', label: 'AUTRE VILLE FICTIVE' },
    ]))(positioned)).rejects.toMatchObject({ status: 409 })
    await expect(createPostalLookup(async () => snapshot([
      mono, { code: '96001', label: 'AUTRE LIBELLE FICTIF' },
    ]))(input)).rejects.toMatchObject({ status: 409 })
  })

  it('does not fabricate an absent label or swallow a repository failure', async () => {
    await expect(createPostalLookup(async () => ({
      available: true, matches: [{ code: '96001', label: null }],
    }))(input)).rejects.toMatchObject({ status: 503 })
    await expect(createPostalLookup(async () => ({
      available: true, matches: [{ code: '96001', label: '   ' }],
    }))(input)).rejects.toMatchObject({ status: 503 })
    await expect(createPostalLookup(async () => { throw new Error('database failure') })(input))
      .rejects.toThrow('database failure')
  })
})
