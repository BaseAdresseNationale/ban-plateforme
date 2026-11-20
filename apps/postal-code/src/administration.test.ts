import { describe, expect, it, vi } from 'vitest'

import { parseDatanovaUpdates, updatePostalDatanova } from './administration.js'

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
})
