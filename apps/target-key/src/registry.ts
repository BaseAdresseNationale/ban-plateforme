import type { Pool } from 'pg'

import type { PreparedMessage } from './keys.js'

export class RegistryUnavailable extends Error {
  constructor(
    readonly reason: 'uninitialized' | 'ambiguous' | 'request-conflict' | 'invalid-state',
  ) {
    super('Target-key registry requires explicit intervention')
    this.name = 'RegistryUnavailable'
  }
}

/** Port of BAN-Plateforme util/base36.cjs, with the historical six-character length. */
export const generatePseudoCode = (random: () => number = Math.random): string => {
  let result = ''
  while (result.length < 6) {
    const sample = random()
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new Error('Invalid random source')
    }
    // Preserve the nominal historical transform. Expand exponent notation and zero,
    // which are valid Math.random values but were not handled by the old slice.
    const decimal = sample.toString()
    const digits = decimal.includes('e') || sample === 0
      ? sample.toFixed(17).slice(2, 17) : decimal.slice(2, 17)
    const integer = Number.parseInt(digits, 10)
    result += integer.toString(36).padStart(10, '0').slice(2)
  }
  return result.slice(0, 6)
}

export const createRegistry = (pool: Pick<Pool, 'connect'>, generate = generatePseudoCode) => ({
  async resolve<T>(
    input: PreparedMessage, select: (codes: Record<string, string>) => T,
  ): Promise<T> {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SET LOCAL lock_timeout = '5s'`)
      await client.query(`SET LOCAL statement_timeout = '15s'`)
      await client.query(
        'INSERT INTO target_key.request (id,input_hash) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [input.id, input.inputHash],
      )
      const { rows: [request] } = await client.query(
        'SELECT input_hash,assignments FROM target_key.request WHERE id=$1 FOR UPDATE', [input.id])
      if (request.input_hash !== input.inputHash) throw new RegistryUnavailable('request-conflict')
      if (request.assignments !== null) {
        const cached = request.assignments
        if (!cached || typeof cached !== 'object' || Array.isArray(cached)
          || input.roads.some(road => typeof cached[road.key] !== 'string')) {
          throw new RegistryUnavailable('invalid-state')
        }
        const result = select(cached)
        await client.query('COMMIT')
        return result
      }
      const scopes = [...new Set(input.roads.map(road => road.cog))].sort()
      const { rows: communes } = scopes.length ? await client.query(
        'SELECT cog,initialized,normalization_version FROM target_key.commune ' +
          'WHERE cog=ANY($1::text[]) ORDER BY cog FOR UPDATE',
        [scopes]) : { rows: [] }
      if (communes.length !== scopes.length
        || communes.some(row => !row.initialized || row.normalization_version !== 1)) {
        throw new RegistryUnavailable('uninitialized')
      }
      const assignments: Record<string, string> = {}
      for (const road of input.roads) {
        let entry: { id: string; code: string } | undefined
        if (road.toponymID) {
          const { rows } = await client.query(
            'SELECT c.id,c.code FROM target_key.binding b JOIN target_key.code c ' +
              'ON c.id=b.code_id AND c.cog=b.cog WHERE b.cog=$1 AND b.toponym_id=$2',
            [road.cog, road.toponymID])
          entry = rows[0]
        }
        if (!entry) {
          const { rows } = await client.query(
            'SELECT c.id,c.code FROM target_key.alias a JOIN target_key.code c ' +
              'ON c.id=a.code_id AND c.cog=a.cog ' +
              'WHERE a.cog=$1 AND a.label=$2 ORDER BY c.id LIMIT 2',
            [road.cog, road.label])
          if (rows.length > 1) throw new RegistryUnavailable('ambiguous')
          entry = rows[0]
        }
        if (!entry) {
          for (let attempt = 0; attempt < 64 && !entry; attempt++) {
            const code = generate()
            if (!/^[a-z0-9]{6}$/.test(code)) throw new Error('Invalid pseudo-code generator')
            const { rows } = await client.query(
              `INSERT INTO target_key.code(cog,code,origin) VALUES($1,$2,'generated') ` +
                'ON CONFLICT DO NOTHING RETURNING id,code',
              [road.cog, code])
            entry = rows[0]
          }
          if (!entry) throw new Error('Pseudo-code collision retry limit reached')
        }
        await client.query(
          'INSERT INTO target_key.alias(cog,label,code_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [road.cog, road.label, entry.id],
        )
        if (road.toponymID) {
          await client.query(
            'INSERT INTO target_key.binding(cog,toponym_id,code_id) VALUES($1,$2,$3) ' +
              'ON CONFLICT DO NOTHING',
            [road.cog, road.toponymID, entry.id],
          )
        }
        assignments[road.key] = entry.code
      }
      const result = select(assignments)
      await client.query('UPDATE target_key.request SET assignments=$2::jsonb WHERE id=$1',
        [input.id, JSON.stringify(assignments)])
      await client.query('COMMIT')
      return result
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  },
})
