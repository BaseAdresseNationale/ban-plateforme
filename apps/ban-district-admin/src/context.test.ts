import { describe, expect, it } from 'vitest'

import {
  canonicalJson, cogSchema, contentHash, contextSchema, referenceSchema, referenceUrl, sha256,
} from './context.js'

const reference = {
  name: '@etalab/decoupage-administratif', version: '6.0.0', millesime: '2026',
  files: Object.fromEntries(['communes', 'departements', 'regions'].map(kind => [kind, {
    url: `https://unpkg.com/@etalab/decoupage-administratif@6.0.0/data/${kind}.json`,
    sha256: 'a'.repeat(64),
  }])),
}

describe('administrative context contract', () => {
  it('keeps zero, empty postal lists and absence distinct without business fields', () => {
    const value = { code: '96001', name: 'COMMUNE FICTIVE', type: 'commune-actuelle' }
    expect(contextSchema.parse({ ...value, population: 0, postalCodes: [] }))
      .toEqual({ ...value, population: 0, postalCodes: [] })
    expect(contextSchema.parse(value)).not.toHaveProperty('population')
    expect(() => contextSchema.parse({ ...value, isActive: false })).toThrow()
    expect(() => contextSchema.parse({ ...value, population: null })).toThrow()
  })

  it.each(['96001', '2A123', '2B123'])('accepts exact COG %s', code => {
    expect(cogSchema.parse(code)).toBe(code)
  })

  it.each(['', '96001\n', 'AAAAA', '123456', '2a123'])('rejects malformed COG %#', code => {
    expect(() => cogSchema.parse(code)).toThrow()
  })

  it.each([-1, NaN, Infinity, 1.5])('rejects invalid populations %#', population => {
    expect(() => contextSchema.parse({
      code: '96001', name: 'FICTIVE', type: 'commune-actuelle', population,
    })).toThrow()
  })

  it('pins provenance to the exact versioned public URLs and checksum shape', () => {
    expect(referenceSchema.parse(reference).version).toBe('6.0.0')
    const invalid = structuredClone(reference)
    invalid.files.communes.url = 'http://127.0.0.1/private'
    expect(() => referenceSchema.parse(invalid)).toThrow()
    expect(() => referenceUrl('../private', 'communes')).toThrow()
  })

  it('hashes canonically without depending on PostgreSQL JSON object order', () => {
    expect(canonicalJson({ z: 0, a: { b: [], omitted: undefined } }))
      .toBe('{"a":{"b":[]},"z":0}')
    const parsed = referenceSchema.parse(reference)
    const left = contextSchema.parse({ code: '96001', name: 'FICTIVE', type: 'commune-actuelle' })
    const right = { type: left.type, name: left.name, code: left.code }
    expect(contentHash(parsed, left)).toBe(contentHash(parsed, right))
    expect(sha256('synthetic')).toMatch(/^[a-f0-9]{64}$/)
    expect(contentHash(parsed, left)).not.toBe(contentHash(parsed, { ...left, code: '96002' }))
  })
})
