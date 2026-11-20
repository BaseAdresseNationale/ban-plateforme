import { describe, expect, it, vi } from 'vitest'

import { writePostalReferences } from './reference-writer.js'
import type { ReferenceSink } from './reference-writer.js'

const code = { cog: '96001', code: '96001', label: 'COMMUNE FICTIVE' }
const geometry = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 0]]] }
const area = { cog: '96001', code: '96001', geometry, sourceSrid: 2154 as const }
const counts = { communes: 1, codes: 1, areas: 1, inconsistent: false }
const load = async (sink: ReferenceSink) => { await sink.code(code); await sink.area(area) }

function database() {
  const query = vi.fn(async (sql: string, _values?: unknown[]):
  Promise<{ rows: Record<string, unknown>[] }> => ({ rows:
    sql.includes('AS inconsistent') ? [counts]
      : sql.includes('RETURNING 1') ? [{ accepted: 1 }] : [],
  }))
  const release = vi.fn()
  const connect = vi.fn(async () => ({ query, release }))
  return { pool: { connect }, query, release }
}

describe('postal reference writer', () => {
  it('validates in connection-local tables and rolls back by default without live DML', async () => {
    const db = database()
    expect(await writePostalReferences(db.pool, load))
      .toEqual({ applied: false, communes: 1, codes: 1, areas: 1 })
    const sql = db.query.mock.calls.map(([sql]) => sql)
    expect(sql[0]).toBe('BEGIN')
    expect(sql[1]).toContain('CREATE TEMP TABLE')
    expect(sql[1]).toContain('ON COMMIT DROP')
    expect(sql.at(-1)).toBe('ROLLBACK')
    expect(sql.some(sql => sql.includes('DELETE FROM postal.'))).toBe(false)
    expect(db.release).toHaveBeenCalledExactlyOnceWith(undefined)
  })

  it('uses parameterized inputs and publishes both references under one writer lock', async () => {
    const db = database()
    const label = "LIEU FICTIF '; SELECT secret; --"
    expect(await writePostalReferences(db.pool, async sink => {
      await sink.code({ ...code, label }); await sink.area(area)
    }, { apply: true })).toMatchObject({ applied: true })
    expect(db.query.mock.calls.find(([sql]) => sql.includes('RETURNING 1'))?.[1])
      .toEqual(['96001', '96001', label])
    expect(db.query.mock.calls.find(([sql]) => sql.includes('ST_GeomFromGeoJSON'))?.[1])
      .toEqual(['96001', '96001', JSON.stringify(geometry), 2154])
    const publication = db.query.mock.calls.find(([sql]) => sql.includes('DELETE FROM postal.'))![0]
    expect(publication).toContain('pg_advisory_xact_lock(834, 12004)')
    expect(publication).toContain('SHARE ROW EXCLUSIVE MODE')
    expect(publication).not.toContain('TRUNCATE')
    expect(publication).toContain('INSERT INTO postal.datanova')
    expect(publication).toContain('INSERT INTO postal.postal_area')
    expect(publication).not.toContain(label)
    expect(db.query.mock.calls.at(-1)?.[0]).toBe('COMMIT')
  })

  it('accepts multipolygons and explicitly declared WGS84', async () => {
    const db = database()
    await writePostalReferences(db.pool, async sink => {
      await sink.code(code)
      await sink.area({ ...area, sourceSrid: 4326,
        geometry: { type: 'MultiPolygon', coordinates: [geometry.coordinates] } })
    })
    expect(db.query.mock.calls.find(([sql]) => sql.includes('ST_GeomFromGeoJSON'))?.[1]?.[3])
      .toBe(4326)
  })

  it.each([
    { ...code, cog: '' }, { ...code, cog: '96001\n' }, { ...code, code: 'bad' },
    { ...code, code: '96001\n' }, { ...code, label: '' }, { ...code, label: '  ' },
    { ...code, label: 'FICTIF\n' }, { ...code, label: 'a'.repeat(513) },
  ])('rejects invalid code references and never publishes %#', async value => {
    const db = database()
    await expect(writePostalReferences(db.pool, sink => sink.code(value), { apply: true }))
      .rejects.toMatchObject({ kind: 'invalid-reference' })
    expect(db.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK')
    expect(db.query.mock.calls.some(([sql]) => sql.includes('DELETE FROM postal.'))).toBe(false)
  })

  it.each([
    null, {}, { type: 'Point', coordinates: [0, 0] }, { type: 'Polygon', coordinates: [] },
    { type: 'MultiPolygon', coordinates: [[]] },
    { type: 'Polygon', coordinates: [[[0, 0], [1, 1], [0, 0]]] },
    { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [5, 5]]] },
    { type: 'Polygon', coordinates: [[[0, 0, 3], [1, 0], [1, 1], [0, 0]]] },
    { type: 'Polygon', coordinates: [[[0, 0], [Infinity, 0], [1, 1], [0, 0]]] },
    { type: 'Polygon', coordinates: [[[0, 0], [NaN, 0], [1, 1], [0, 0]]] },
  ])('rejects malformed geometries before SQL insertion %#', async value => {
    const db = database()
    await expect(writePostalReferences(db.pool, sink => sink.area({ ...area, geometry: value })))
      .rejects.toMatchObject({ kind: 'invalid-reference' })
    expect(db.query.mock.calls.some(([sql]) => sql.includes('ST_GeomFromGeoJSON'))).toBe(false)
  })

  it('rejects out-of-range WGS84 without guessing or relabeling its projection', async () => {
    const db = database()
    await expect(writePostalReferences(db.pool, sink => sink.area({ ...area, sourceSrid: 4326,
      geometry: { type: 'Polygon', coordinates: [[[181, 0], [182, 0], [182, 1], [181, 0]]] },
    }))).rejects.toMatchObject({ kind: 'invalid-reference' })
  })

  it.each([
    { ...counts, communes: 0 }, { ...counts, codes: 0 }, { ...counts, areas: 0 },
    { ...counts, inconsistent: true }, { ...counts, codes: '1' },
  ])('rejects empty, inconsistent or malformed candidates %#', async result => {
    const db = database()
    db.query.mockImplementation(async sql => ({ rows:
      sql.includes('AS inconsistent') ? [result] : [{ accepted: 1 }],
    }))
    await expect(writePostalReferences(db.pool, load, { apply: true }))
      .rejects.toMatchObject({ kind: 'invalid-reference' })
    expect(db.query.mock.calls.some(([sql]) => sql.includes('DELETE FROM postal.'))).toBe(false)
  })

  it('refuses contradictory labels instead of choosing one', async () => {
    const db = database()
    db.query.mockImplementation(async () => ({ rows: [] }))
    await expect(writePostalReferences(db.pool, load))
      .rejects.toMatchObject({ kind: 'invalid-reference', message: 'Conflicting postal labels' })
  })

  it('rolls back loader and publication failures without exposing their diagnostics', async () => {
    for (const publication of [false, true]) {
      const db = database()
      const implementation = db.query.getMockImplementation()!
      db.query.mockImplementation(async (sql, values) => {
        if (publication && sql.includes('DELETE FROM postal.')) throw new Error('private SQL')
        return implementation(sql, values)
      })
      const operation = publication ? load : async () => { throw new Error('private file path') }
      await expect(writePostalReferences(db.pool, operation, { apply: true }))
        .rejects.toMatchObject({ kind: 'storage', message: 'Postal reference operation failed' })
      expect(db.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK')
      expect(db.release).toHaveBeenCalledTimes(1)
    }
  })

  it('never announces success if COMMIT confirmation is lost', async () => {
    const db = database()
    const implementation = db.query.getMockImplementation()!
    db.query.mockImplementation(async (sql, values) => {
      if (sql === 'COMMIT') throw new Error('private connection detail')
      return implementation(sql, values)
    })
    await expect(writePostalReferences(db.pool, load, { apply: true }))
      .rejects.toMatchObject({ kind: 'publication-unknown' })
    expect(db.release).toHaveBeenCalledTimes(1)
  })

  it('discards the connection when rollback fails', async () => {
    const db = database()
    db.query.mockRejectedValue(new Error('private SQL'))
    await expect(writePostalReferences(db.pool, load)).rejects.toMatchObject({ kind: 'storage' })
    expect(db.release).toHaveBeenCalledWith(expect.any(Error))
  })

  it('does not allocate a connection for an already cancelled operation', async () => {
    const db = database()
    await expect(writePostalReferences(db.pool, load, { signal: AbortSignal.abort() }))
      .rejects.toMatchObject({ kind: 'storage' })
    expect(db.pool.connect).not.toHaveBeenCalled()
  })

  it('rejects reuse of a closed candidate sink', async () => {
    const db = database()
    let retained: ReferenceSink | undefined
    await writePostalReferences(db.pool, async sink => { retained = sink; await load(sink) })
    await expect(retained!.code(code)).rejects.toMatchObject({ kind: 'invalid-reference' })
  })
})
