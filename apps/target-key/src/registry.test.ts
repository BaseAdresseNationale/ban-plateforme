import type { Pool } from 'pg'
import { describe, expect, it, vi } from 'vitest'

import { prepareMessage } from './keys.js'
import { createRegistry, generatePseudoCode, RegistryUnavailable } from './registry.js'

const message = () => prepareMessage({ id: 'synthetic-registry-job', rows: [{
  __balRowIndex: 0, commune_insee: '96001', voie_nom: 'Voie fictive', numero: 12,
  id_ban_toponyme: '00000000-0000-4000-8000-000000000001',
}] })

const fixture = (options: {
  initialized?: boolean; bindings?: { id: string; code: string }[]
  aliases?: { id: string; code: string }[]; cached?: unknown
  hash?: string; failInsert?: boolean
} = {}) => {
  const input = message()
  const release = vi.fn()
  const query = vi.fn(async (sql: string) => {
    if (sql.startsWith('SELECT input_hash')) return { rows: [{
      input_hash: options.hash ?? input.inputHash, assignments: options.cached ?? null,
    }] }
    if (sql.startsWith('SELECT cog')) return { rows: [{
      cog: '96001', initialized: options.initialized ?? true, normalization_version: 1,
    }] }
    if (sql.includes('FROM target_key.binding')) return { rows: options.bindings ?? [] }
    if (sql.includes('FROM target_key.alias')) return { rows: options.aliases ?? [] }
    if (sql.startsWith('INSERT INTO target_key.code')) {
      return { rows: options.failInsert ? [] : [{ id: '7', code: 'abc123' }] }
    }
    return { rows: [] }
  })
  const connect = vi.fn(async () => ({ query, release }))
  const pool = { connect } as unknown as Pick<Pool, 'connect'>
  const generate = vi.fn(() => 'abc123')
  return { input, query, release, generate, registry: createRegistry(pool, generate) }
}

describe('transactional target-key registry', () => {
  it('preserves the bound code and records a rename alias', async () => {
    const test = fixture({ bindings: [{ id: '2', code: 'A001' }] })
    await expect(test.registry.resolve(test.input, codes => codes))
      .resolves.toEqual({ [test.input.rowKeys[0]]: 'A001' })
    expect(test.generate).not.toHaveBeenCalled()
    expect(test.query.mock.calls.some(([sql]) => sql.includes('FROM target_key.alias'))).toBe(false)
    expect(test.query.mock.calls.some(([sql]) => sql.startsWith('INSERT INTO target_key.alias')))
      .toBe(true)
    expect(test.query.mock.calls.at(-1)).toEqual(['COMMIT'])
    expect(test.release).toHaveBeenCalledOnce()
  })

  it('reuses an unambiguous name and allocates only when absent', async () => {
    const known = fixture({ aliases: [{ id: '3', code: 'a002' }] })
    await known.registry.resolve(known.input, codes => codes)
    expect(known.generate).not.toHaveBeenCalled()
    const absent = fixture()
    await expect(absent.registry.resolve(absent.input, codes => codes))
      .resolves.toEqual({ [absent.input.rowKeys[0]]: 'abc123' })
    expect(absent.generate).toHaveBeenCalledOnce()
  })

  it.each([
    { initialized: false },
    { hash: '0'.repeat(64) },
    { aliases: [{ id: '2', code: 'a001' }, { id: '3', code: 'b001' }] },
  ])('rolls back an unavailable or conflicting allocation (%j)', async options => {
    const test = fixture(options)
    await expect(test.registry.resolve(test.input, codes => codes))
      .rejects.toBeInstanceOf(RegistryUnavailable)
    expect(test.query.mock.calls.at(-1)).toEqual(['ROLLBACK'])
    expect(test.release).toHaveBeenCalledOnce()
  })

  it('replays saved assignments without reallocating and validates before commit', async () => {
    const input = message()
    const test = fixture({ cached: { [input.rowKeys[0]]: 'a003' } })
    await expect(test.registry.resolve(test.input, codes => codes[input.rowKeys[0]]))
      .resolves.toBe('a003')
    expect(test.generate).not.toHaveBeenCalled()
    expect(test.query.mock.calls.some(([sql]) => sql.startsWith('SELECT cog'))).toBe(false)
  })

  it('rolls back contradictory address results', async () => {
    const test = fixture()
    await expect(test.registry.resolve(test.input, () => { throw new Error('fixture conflict'); }))
      .rejects.toThrow('fixture conflict')
    expect(test.query.mock.calls.at(-1)).toEqual(['ROLLBACK'])
    expect(test.query.mock.calls.some(([sql]) => sql.startsWith('UPDATE target_key.request')))
      .toBe(false)
  })

  it('bounds collisions and transaction waits locally', async () => {
    const test = fixture({ failInsert: true })
    await expect(test.registry.resolve(test.input, codes => codes)).rejects.toThrow(/collision/)
    expect(test.generate).toHaveBeenCalledTimes(64)
    expect(test.query.mock.calls.some(([sql]) => sql === "SET LOCAL lock_timeout = '5s'"))
      .toBe(true)
    expect(test.query.mock.calls.some(([sql]) => sql === "SET LOCAL statement_timeout = '15s'"))
      .toBe(true)
    expect(test.release).toHaveBeenCalledOnce()
  })

  it('uses the historical base36 transformation and length, not producer x counters', () => {
    expect(generatePseudoCode(() => 0.123456789)).toBe(
      Number.parseInt('123456789', 10).toString(36).padStart(10, '0').slice(2, 8),
    )
    expect(generatePseudoCode()).toMatch(/^[a-z0-9]{6}$/)
    expect(generatePseudoCode(() => 0)).toBe('000000')
    expect(generatePseudoCode(() => 1e-8)).toMatch(/^[a-z0-9]{6}$/)
    expect(() => generatePseudoCode(() => 1)).toThrow('Invalid random source')
  })
})
