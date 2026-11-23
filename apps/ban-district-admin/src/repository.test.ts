import { describe, expect, it, vi } from 'vitest'

import { createReference, currentReference } from './reference.js'
import { createDistrictRepository, districtQuery, lockDistrictQuery } from './repository.js'
import type { DatabaseClient } from './repository.js'

const id = '11111111-1111-4111-8111-111111111101'
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value))
const loaded = createReference(currentReference, {
  communes: bytes([{ code: '96001', nom: 'FICTIVE', type: 'commune-actuelle' }]),
  departements: bytes([{ code: '96', nom: 'DEPARTEMENT FICTIF' }]),
  regions: bytes([{ code: '99', nom: 'REGION FICTIVE' }]),
})
const resolution = loaded.resolve('96001')
if (resolution.status !== 'found') throw new Error('Expected synthetic context')
const payload = {
  sourceCog: '96001', reference: loaded.reference,
  context: resolution.context, contentHash: resolution.contentHash,
}
const row = { cog: '96001', active: true, source_cog: null }
const storedRow = { ...row, source_cog: '96001', reference: payload.reference,
  context: payload.context, content_hash: payload.contentHash }

function database(lockedRow: Record<string, unknown> | undefined = row) {
  const release = vi.fn()
  const query = vi.fn<DatabaseClient['query']>(async sql => ({
    rows: (sql.startsWith('\nSELECT') || sql === lockDistrictQuery) && lockedRow
      ? [lockedRow] : [],
  }))
  const connect = vi.fn().mockResolvedValue({ query, release })
  return { query, release, connect }
}

describe('district context repository', () => {
  it('parameterizes reads and validates stored provenance without importing a pool', async () => {
    const db = database(storedRow)
    expect(await createDistrictRepository(db).read(id)).toMatchObject({
      cog: '96001', active: true, stored: payload,
    })
    expect(db.query).toHaveBeenCalledWith(districtQuery, [id])
    expect(db.connect).not.toHaveBeenCalled()
  })

  it('locks and rechecks the district, then updates only its service table', async () => {
    const db = database()
    expect(await createDistrictRepository(db).save(id, '96001', payload, true)).toBe('updated')
    const statements = db.query.mock.calls.map(([sql]) => sql)
    expect(statements[0]).toBe('BEGIN')
    expect(statements).toContain(lockDistrictQuery)
    const write = db.query.mock.calls.find(([sql]) => sql.includes('INSERT INTO'))
    expect(write?.[0]).toContain('INSERT INTO district_admin.context')
    expect(write?.[1]).toEqual([id, '96001', JSON.stringify(payload.reference),
      JSON.stringify(payload.context), payload.contentHash])
    expect(statements.some(sql => /(?:UPDATE|INSERT INTO|DELETE FROM) ban\./.test(sql))).toBe(false)
    expect(statements.at(-1)).toBe('COMMIT')
    expect(db.release).toHaveBeenCalledOnce()
  })

  it('does not write for a dry run or a controlled replay with the same content', async () => {
    for (const [db, apply, expected] of [
      [database(), false, 'updated'], [database(storedRow), true, 'unchanged'],
    ] as const) {
      expect(await createDistrictRepository(db).save(id, '96001', payload, apply)).toBe(expected)
      expect(db.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO'))).toBe(false)
      expect(db.release).toHaveBeenCalledOnce()
    }
  })

  it.each([
    [{ ...row, cog: '96002' }, 'stale'], [{ ...row, active: false }, 'stale'],
    [undefined, 'missing'],
  ] as const)('does not save after concurrent district change %#', async (changed, status) => {
    const db = database()
    db.query.mockImplementation(async sql => ({
      rows: (sql === lockDistrictQuery || sql.includes('FROM district_admin.context')) && changed
        ? [changed] : [],
    }))
    expect(await createDistrictRepository(db).save(id, '96001', payload, true)).toBe(status)
    expect(db.query.mock.calls.some(([sql]) => sql.includes('INSERT INTO'))).toBe(false)
  })

  it('rolls back failed writes, releases the client and never reports a success', async () => {
    const db = database()
    db.query.mockImplementation(async sql => {
      if (sql.includes('INSERT INTO')) throw new Error('private SQL diagnostic')
      const readsState = sql === lockDistrictQuery || sql.includes('FROM district_admin.context')
      return { rows: readsState ? [row] : [] }
    })
    await expect(createDistrictRepository(db).save(id, '96001', payload, true))
      .rejects.toThrow('private SQL diagnostic')
    expect(db.query.mock.calls.at(-1)?.[0]).toBe('ROLLBACK')
    expect(db.release).toHaveBeenCalledOnce()
  })

  it.each([
    { ...storedRow, context: { ...payload.context, population: -1 } },
    { ...storedRow, content_hash: 'f'.repeat(64) },
    { ...storedRow, source_cog: '96002' },
    { ...row, active: 'true' },
  ])('refuses corrupt stored data %#', async corrupted => {
    await expect(createDistrictRepository(database(corrupted)).read(id)).rejects.toThrow()
  })

  it('refuses malformed identifiers and payloads before any SQL or connection', async () => {
    const db = database()
    await expect(createDistrictRepository(db).read("'; SELECT private_data; --")).rejects.toThrow()
    await expect(createDistrictRepository(db).save(id, '96002', payload, true)).rejects.toThrow()
    expect(db.query).not.toHaveBeenCalled()
    expect(db.connect).not.toHaveBeenCalled()
  })
})
