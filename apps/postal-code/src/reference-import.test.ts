import { createHash } from 'node:crypto'
import { Readable } from 'node:stream'
import { setImmediate as nextTurn } from 'node:timers/promises'

import { describe, expect, it, vi } from 'vitest'

import { importPostalReferences, loadPostalSources } from './reference-import.js'
import { PostalReferenceError } from './reference-writer.js'

const csv = 'Code_commune_INSEE;Code_postal;Libellé_d_acheminement\n96001;96001;VILLE FICTIVE\n'
const geometry = { type: 'Polygon', coordinates: [[[0,0],[2,0],[2,2],[0,0]]] }
const feature = { type: 'Feature', properties: { cp: '96001', insee_com: '96001' }, geometry }
const collection = { type: 'FeatureCollection', features: [feature] }
const json = JSON.stringify(collection)
const source = (text: string | Buffer) => Readable.from([text])
const sources = (data = csv, geo = json) => ({
  datanova: source(data), areas: source(geo), sourceSrid: 2154 as const,
})
const sink = () => ({ code: vi.fn(async () => {}), area: vi.fn(async () => {}) })

describe('postal source reader', () => {
  it('reads official CSV headers and GeoJSON records with byte fingerprints', async () => {
    const target = sink()
    const result = await loadPostalSources(sources(), target)
    expect(target.code).toHaveBeenCalledExactlyOnceWith({
      cog: '96001', code: '96001', label: 'VILLE FICTIVE',
    })
    expect(target.area).toHaveBeenCalledExactlyOnceWith({
      cog: '96001', code: '96001', geometry, sourceSrid: 2154,
    })
    expect(result.datanova).toEqual({ bytes: Buffer.byteLength(csv), records: 1,
      sha256: createHash('sha256').update(csv).digest('hex') })
    expect(result.areas).toEqual({ bytes: Buffer.byteLength(json), records: 1,
      sha256: createHash('sha256').update(json).digest('hex') })
  })

  it('supports quoted separators, BOM and optional unused columns', async () => {
    const target = sink()
    await loadPostalSources(sources('\ufeffCode_commune_INSEE;Code_postal;Libellé_d_acheminement;Ligne_5\r\n'
      + '96001;96001;"VILLE; FICTIVE";EXEMPLE\r\n'), target)
    expect(target.code).toHaveBeenCalledWith({ cog: '96001', code: '96001', label: 'VILLE; FICTIVE' })
  })

  it('supports an explicitly selected comma delimiter', async () => {
    const target = sink()
    await loadPostalSources({ ...sources(csv.replaceAll(';', ',')), delimiter: ',' }, target)
    expect(target.code).toHaveBeenCalledTimes(1)
  })

  it('preserves UTF-8 characters split across byte chunks and canonicalizes COG casing', async () => {
    const target = sink()
    const data = csv.replaceAll('96001', '2a123').replace('VILLE FICTIVE', 'ÎLE FICTIVE')
      .replace(';2a123;', ';96001;')
    const geo = json.replace('"insee_com":"96001"', '"insee_com":"2a123"')
    await loadPostalSources({ datanova: Readable.from([...Buffer.from(data)].map(b => Buffer.from([b]))),
      areas: Readable.from([...Buffer.from(geo)].map(b => Buffer.from([b]))), sourceSrid: 2154 }, target)
    expect(target.code).toHaveBeenCalledWith({ cog: '2A123', code: '96001', label: 'ÎLE FICTIVE' })
    expect(target.area.mock.calls[0]).toBeDefined()
  })

  it.each([
    '', 'code_commune_insee;code_postal\n96001;96001\n',
    'code_commune_insee;code_postal;libelle_d_acheminement\n',
    'code_commune_insee;code_postal;libelle_d_acheminement;CODE_POSTAL\n96001;96001;FICTIF;96001\n',
    'code_commune_insee;code_postal;libelle_d_acheminement\n96001;96001\n',
    'code_commune_insee;code_postal;libelle_d_acheminement\n96001;96001;"unfinished\n',
  ])('rejects missing, ambiguous or malformed CSV input %#', async data => {
    await expect(loadPostalSources(sources(data), sink()))
      .rejects.toMatchObject({ kind: 'invalid-reference' })
  })

  it.each([
    '', '[]', '{}', JSON.stringify({ type: 'Polygon', features: [feature] }),
    JSON.stringify({ type: 'FeatureCollection', features: [] }),
    JSON.stringify({ type: 'FeatureCollection', features: null }),
    JSON.stringify({ type: 'FeatureCollection', features: [1] }),
    JSON.stringify({ type: 'FeatureCollection', features: [{ ...feature, type: 'Other' }] }),
    JSON.stringify({ type: 'FeatureCollection', features: [{ ...feature, properties: {} }] }),
    JSON.stringify({ type: 'FeatureCollection', features: [{ ...feature, geometry: null }] }),
    json.slice(0, -1), json + '{}', json + ' trailing',
    json.replace('"type":"FeatureCollection"', '"type":"FeatureCollection","type":"Other"'),
    json.replace('"cp":"96001"', '"cp":"96001","cp":"96002"'),
  ])('rejects invalid GeoJSON envelopes, features and trailing data %#', async geo => {
    await expect(loadPostalSources(sources(csv, geo), sink()))
      .rejects.toMatchObject({ kind: 'invalid-reference' })
  })

  it.each(['EPSG:2154', 'urn:ogc:def:crs:EPSG::2154'])(
    'accepts matching explicit projection metadata %s', async name => {
      const geo = JSON.stringify({ ...collection, crs: { type: 'name', properties: { name } } })
      await expect(loadPostalSources(sources(csv, geo), sink()))
        .resolves.toHaveProperty('areas.records', 1)
    },
  )

  it('accepts a declared WGS84 source without guessing from coordinate values', async () => {
    const geo = JSON.stringify({ ...collection,
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } } })
    const target = sink()
    await loadPostalSources({ ...sources(csv, geo), sourceSrid: 4326 }, target)
    expect(target.area).toHaveBeenCalledWith(expect.objectContaining({ sourceSrid: 4326 }))
  })

  it.each([
    { type: 'name', properties: { name: 'EPSG:4326' } },
    { type: 'name', properties: { name: 'EPSG:9999' } }, 'EPSG:2154', {},
  ])('rejects contradictory or unsupported CRS metadata even after features %#', async crs => {
    await expect(loadPostalSources(sources(csv, JSON.stringify({ ...collection, crs })), sink()))
      .rejects.toMatchObject({ kind: 'invalid-reference' })
  })

  it('rejects a geometry-specific CRS contradicting the declared source', async () => {
    const geo = JSON.stringify({ ...collection, features: [{ ...feature, geometry: {
      ...geometry, crs: { type: 'name', properties: { name: 'EPSG:4326' } },
    } }] })
    await expect(loadPostalSources(sources(csv, geo), sink()))
      .rejects.toMatchObject({ kind: 'invalid-reference' })
  })

  it('rejects a Feature-specific CRS contradicting the declared source', async () => {
    const geo = JSON.stringify({ ...collection, features: [{ ...feature,
      crs: { type: 'name', properties: { name: 'EPSG:4326' } },
    }] })
    await expect(loadPostalSources(sources(csv, geo), sink()))
      .rejects.toMatchObject({ kind: 'invalid-reference' })
  })

  it.each([
    { sourceBytes: 10 }, { featureCost: 20 }, { packedLength: 5 },
  ])('enforces byte, feature and packed-value limits %#', async limits => {
    await expect(loadPostalSources(sources(), sink(), { limits }))
      .rejects.toMatchObject({ kind: 'invalid-reference' })
  })

  it('rejects deep JSON metadata and invalid UTF-8 without replacement characters', async () => {
    const nested = '['.repeat(40) + '0' + ']'.repeat(40)
    await expect(loadPostalSources(sources(csv, json.slice(0, -1) + ',"metadata":' + nested + '}'), sink()))
      .rejects.toMatchObject({ kind: 'invalid-reference' })
    await expect(loadPostalSources({ ...sources(), datanova: source(Buffer.from([0xff])) }, sink()))
      .rejects.toMatchObject({ kind: 'invalid-reference' })
  })

  it('does not interpret prototype properties as source fields', async () => {
    const geo = json.replace('"properties":{"cp":"96001","insee_com":"96001"}',
      '"properties":{"__proto__":{"cp":"96001","insee_com":"96001"}}')
    await expect(loadPostalSources(sources(csv, geo), sink()))
      .rejects.toMatchObject({ kind: 'invalid-reference' })
    expect(Object.hasOwn(Object.prototype, 'cp')).toBe(false)
  })

  it('closes both streams on reader or sink failure and masks source diagnostics', async () => {
    const input = sources()
    input.datanova = new Readable({ read() { this.destroy(new Error('/private/source.csv')) } })
    await expect(loadPostalSources(input, sink())).rejects.toMatchObject({
      message: 'Unable to read or decode postal sources',
    })
    expect(input.datanova.destroyed).toBe(true)
    expect(input.areas.destroyed).toBe(true)
    const input2 = sources()
    const target = sink()
    target.code.mockRejectedValue(new PostalReferenceError('storage', 'Postal reference operation failed'))
    await expect(loadPostalSources(input2, target)).rejects.toMatchObject({ kind: 'storage' })
    expect(input2.areas.destroyed).toBe(true)
  })

  it('applies backpressure instead of materializing the whole feature collection', async () => {
    let produced = 0
    let release!: () => void
    let first!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const ready = new Promise<void>(resolve => { first = resolve })
    const areas = Readable.from((async function* () {
      yield '{"type":"FeatureCollection","features":['
      for (let i = 0; i < 10_000; i++) {
        produced++
        yield (i ? ',' : '') + JSON.stringify(feature)
      }
      yield ']}'
    })())
    const target = sink()
    target.area.mockImplementationOnce(async () => { first(); await held })
    const loading = loadPostalSources({ ...sources(), areas }, target)
    try {
      await Promise.race([ready, loading])
      expect(produced).toBeGreaterThan(0)
      expect(produced).toBeLessThan(10_000)
    } finally { release(); await loading }
    expect(target.area).toHaveBeenCalledTimes(10_000)
  })

  it('rolls back the candidate on a late source failure without publishing', async () => {
    const query = vi.fn(async (sql: string) => ({ rows:
      sql.includes('RETURNING 1') ? [{ accepted: 1 }] : [],
    }))
    const release = vi.fn()
    const pool = { connect: async () => ({ query, release }) }
    await expect(importPostalReferences(pool, sources(csv, json.slice(0, -1)), { apply: true }))
      .rejects.toMatchObject({ kind: 'invalid-reference' })
    expect(query.mock.calls.some(([sql]) => sql.includes('RETURNING 1'))).toBe(true)
    expect(query.mock.calls.some(([sql]) => sql.includes('DELETE FROM postal.'))).toBe(false)
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK')
    expect(release).toHaveBeenCalledTimes(1)
  })

  it('closes unused sources when the database cannot allocate a connection', async () => {
    const input = sources()
    const pool = { connect: async (): Promise<never> => { throw new Error('private connection') } }
    await expect(importPostalReferences(pool, input)).rejects.toMatchObject({ kind: 'storage' })
    expect(input.datanova.destroyed).toBe(true)
    expect(input.areas.destroyed).toBe(true)
  })

  it('handles an unread area-stream error while CSV is awaiting downstream work', async () => {
    let started!: () => void
    let resume!: () => void
    const ready = new Promise<void>(resolve => { started = resolve })
    const held = new Promise<void>(resolve => { resume = resolve })
    const input = sources()
    input.datanova = Readable.from((async function* () {
      started(); await held; yield csv
    })())
    const loading = loadPostalSources(input, sink())
    const rejected = expect(loading).rejects.toMatchObject({ kind: 'invalid-reference' })
    try {
      await ready
      input.areas.destroy(new Error('private unopened file failure'))
      await nextTurn()
    } finally { resume() }
    await rejected
    expect(input.datanova.destroyed).toBe(true)
    expect(input.areas.destroyed).toBe(true)
  })

  it('handles early input errors before the database connection is available', async () => {
    let connect!: (value: { query: (sql: string) => Promise<{ rows: Record<string, unknown>[] }>;
      release: () => void }) => void
    const query = vi.fn<(sql: string) => Promise<{ rows: Record<string, unknown>[] }>>()
      .mockResolvedValue({ rows: [] })
    const pool = { connect: () => new Promise<Parameters<typeof connect>[0]>(resolve => {
      connect = resolve
    }) }
    const input = sources()
    const loading = importPostalReferences(pool, input, { apply: true })
    const rejected = expect(loading).rejects.toMatchObject({ kind: 'invalid-reference' })
    input.datanova.destroy(new Error('private file open failure'))
    await nextTurn()
    connect({ query, release: () => {} })
    await rejected
    expect(query.mock.calls.some(([sql]) => sql.includes('DELETE FROM postal.'))).toBe(false)
    expect(input.areas.destroyed).toBe(true)
  })

  it.each(['code', 'area'])('keeps a real SQL %s insert failure classified as storage', async kind => {
    const query = vi.fn(async (sql: string) => {
      if ((kind === 'code' && sql.includes('RETURNING 1'))
        || (kind === 'area' && sql.includes('ST_GeomFromGeoJSON'))) {
        throw new Error('private PostgreSQL connection detail')
      }
      return { rows: sql.includes('RETURNING 1') ? [{ accepted: 1 }] : [] }
    })
    const pool = { connect: async () => ({ query, release: () => {} }) }
    await expect(importPostalReferences(pool, sources(), { apply: true }))
      .rejects.toMatchObject({ kind: 'storage', message: 'Postal reference operation failed' })
    expect(query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK')
  })
})
