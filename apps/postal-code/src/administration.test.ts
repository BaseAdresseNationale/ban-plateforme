import { describe, expect, it, vi } from 'vitest'

import {
  parseDatanovaUpdates,
  parsePostalAreas,
  replacePostalAreas,
  updatePostalDatanova,
} from './administration.js'

const item = {
  inseeCom: '96001', postalCodes: ['96002', '96001'],
  libelleAcheminementWithPostalCodes: { '96001': 'SECTEUR FICTIF A', '96002': 'SECTEUR FICTIF B' },
}

function database() {
  const query = vi.fn(async (sql: string, _values?: unknown[]):
  Promise<{ rows: Record<string, unknown>[] }> => ({ rows: sql.includes('RETURNING id')
    ? [{ id: 1 }] : [] }))
  const release = vi.fn()
  const connect = vi.fn(async () => ({ query, release }))
  return { pool: { connect }, query, release }
}

describe('postal administration', () => {
  it('accepts compatibility fields without claiming to record an audit', () => {
    expect(parseDatanovaUpdates([{ ...item, updatedBy: 'TEST', updateNote: 'TEST' }]))
      .toEqual([{ ...item, postalCodes: ['96001', '96002'] }])
    expect(parseDatanovaUpdates([{ ...item, inseeCom: '2A001' }])[0].inseeCom).toBe('2A001')
  })

  it.each([
    null, {}, [], Array(101).fill(item), [item, item],
    [{ ...item, inseeCom: '96001\n' }], [{ ...item, id: 1 }],
    [{ ...item, geometry: {} }], [{ ...item, postalCodes: [] }],
    [{ ...item, postalCodes: ['96001', '96001'] }],
    [{ ...item, postalCodes: ['bad'] }],
    [{ ...item, libelleAcheminementWithPostalCodes: { '96001': 'FICTIF' } }],
    [{ ...item, libelleAcheminementWithPostalCodes: { '96001': 1, '96002': 'FICTIF' } }],
    [{ ...item, libelleAcheminementWithPostalCodes: { '96001': ' ', '96002': 'FICTIF' } }],
    [{ ...item, updatedBy: '' }], [{ ...item, updateNote: 42 }],
    [{ ...item, postalCodes: Array(1001).fill('96001') }],
  ])('rejects malformed or arbitrary updates before connecting %#', async input => {
    const db = database()
    await expect(updatePostalDatanova(db.pool, input)).rejects.toMatchObject({
      kind: 'invalid-reference',
    })
    expect(db.pool.connect).not.toHaveBeenCalled()
  })

  it('uses parameters and the import publication lock, without inserting a commune', async () => {
    const db = database()
    const label = "FICTIF '; SELECT private; --"
    expect(await updatePostalDatanova(db.pool, [{ ...item,
      libelleAcheminementWithPostalCodes: { '96001': label, '96002': 'FICTIF' },
    }])).toEqual([{ inseeCom: '96001', updatedRowsCount: 1 }])
    const calls = db.query.mock.calls
    expect(calls[0][0]).toBe('BEGIN')
    expect(calls[1][0]).toContain('pg_advisory_xact_lock(834, 12004)')
    expect(calls[2][0]).not.toContain(label)
    expect(calls[2][1]?.slice(0, 2)).toEqual(['96001', ['96001', '96002']])
    expect(calls[2][0]).not.toMatch(/INSERT|DELETE/)
    expect(calls.at(-1)?.[0]).toBe('COMMIT')
    expect(db.release).toHaveBeenCalledExactlyOnceWith(undefined)
  })

  it('distinguishes missing rows and isolated storage failures in a batch', async () => {
    const db = database()
    db.query.mockImplementation(async (sql, values) => {
      if (sql.includes('RETURNING id') && values?.[0] === '96002') throw new Error('private SQL')
      return { rows: [] }
    })
    expect(await updatePostalDatanova(db.pool, [item, { ...item, inseeCom: '96002' }]))
      .toEqual([
        { inseeCom: '96001', updatedRowsCount: 0 },
        { inseeCom: '96002', updatedRowsCount: 0, error: 'Database update failed' },
      ])
    expect(db.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK')
    expect(db.release).toHaveBeenCalledTimes(2)
  })

  it('validates every item before writing the first', async () => {
    const db = database()
    await expect(updatePostalDatanova(db.pool, [item, { ...item, id: 1 }])).rejects.toThrow()
    expect(db.pool.connect).not.toHaveBeenCalled()
  })

  it('does not report success on a lost COMMIT and discards the connection', async () => {
    const db = database()
    const implementation = db.query.getMockImplementation()!
    db.query.mockImplementation(async (sql, values) => {
      if (sql === 'COMMIT') throw new Error('private connection')
      return implementation(sql, values)
    })
    await expect(updatePostalDatanova(db.pool, [item])).rejects.toMatchObject({
      kind: 'publication-unknown',
    })
    expect(db.release).toHaveBeenCalledWith(expect.any(Error))
  })

  it('discards a client whose rollback fails and sanitizes the reported failure', async () => {
    const db = database()
    db.query.mockRejectedValue(new Error('private SQL'))
    expect(await updatePostalDatanova(db.pool, [item])).toEqual([
      { inseeCom: '96001', updatedRowsCount: 0, error: 'Database update failed' },
    ])
    expect(db.release).toHaveBeenCalledWith(expect.any(Error))
  })

  const geometry = { type: 'Polygon', coordinates: [[[0, 0], [10, 0], [10, 10], [0, 0]]] }
  const area = { postalCode: '96001', geometry }
  const areaDatabase = () => {
    const db = database()
    db.query.mockImplementation(async sql => ({ rows:
      sql.includes('AS valid') ? [{ valid: true }] : sql.includes('AS count') ? [{ count: 2 }]
        : sql.includes('RETURNING id') ? [{ id: 1 }] : [],
    }))
    return db
  }

  it('shares geometry validation with the importer and keeps several contours per code', () => {
    const parsed = parsePostalAreas([area, area])
    expect(parsed).toEqual(Array(2).fill({
      postalCode: '96001', geometry: JSON.stringify(geometry),
    }))
    expect(parsePostalAreas([{ ...area, geometry: {
      type: 'MultiPolygon', coordinates: [geometry.coordinates],
    }, updatedBy: 'TEST', updateNote: 'TEST' }])).toHaveLength(1)
  })

  it.each([
    null, [], Array(1001).fill(area), [{ ...area, postalCode: 'bad' }],
    [{ ...area, id: 1 }], [{ ...area, inseeCom: '96002' }],
    [{ ...area, geometry: { type: 'Point', coordinates: [0, 0] } }],
    [{ ...area, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 1], [0, 0]]] } }],
  ])('rejects invalid replacements before allocating a connection %#', async input => {
    const db = areaDatabase()
    await expect(replacePostalAreas(db.pool, '96001', input)).rejects.toMatchObject({
      kind: 'invalid-reference',
    })
    expect(db.pool.connect).not.toHaveBeenCalled()
  })

  it('validates the commune before SQL and refuses arbitrary paths', async () => {
    const db = areaDatabase()
    await expect(replacePostalAreas(db.pool, "x';--", [area])).rejects.toThrow()
    expect(db.pool.connect).not.toHaveBeenCalled()
  })

  it('validates topology first, replaces only one commune and commits exact counts', async () => {
    const db = areaDatabase()
    expect(await replacePostalAreas(db.pool, '96001', [area])).toEqual({
      createdCount: 1, deletedCount: 2,
    })
    const calls = db.query.mock.calls
    expect(calls[1][0]).toContain('pg_advisory_xact_lock(834, 12004)')
    expect(calls[2][0]).toContain('AS valid')
    expect(calls[3][1]).toEqual(['96001'])
    expect(calls[3][0]).toContain('WHERE "inseeCom" = $1')
    expect(calls[4][1]).toEqual(['96001', '96001', JSON.stringify(geometry)])
    expect(calls.at(-1)?.[0]).toBe('COMMIT')
  })

  it('rejects invalid topology before live deletion', async () => {
    const db = areaDatabase()
    db.query.mockResolvedValue({ rows: [{ valid: false }] })
    await expect(replacePostalAreas(db.pool, '96001', [area])).rejects.toMatchObject({
      kind: 'invalid-reference',
    })
    expect(db.query.mock.calls.some(([sql]) => sql.includes('DELETE'))).toBe(false)
    expect(db.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK')
  })

  it('rolls back a late insertion failure and sanitizes its diagnostics', async () => {
    const db = areaDatabase()
    const implementation = db.query.getMockImplementation()!
    db.query.mockImplementation(async (sql, values) => {
      if (sql.includes('INSERT INTO')) throw new Error('private SQL')
      return implementation(sql, values)
    })
    await expect(replacePostalAreas(db.pool, '96001', [area])).rejects.toMatchObject({
      kind: 'storage', message: 'Postal reference operation failed',
    })
    expect(db.query.mock.calls.some(([sql]) => sql.includes('DELETE'))).toBe(true)
    expect(db.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK')
  })
})
