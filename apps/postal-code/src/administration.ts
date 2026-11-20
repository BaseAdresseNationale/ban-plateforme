import {
  isPostalCode,
  isPostalCog,
  isPostalLabel,
  postalPublicationLock,
  PostalReferenceError,
} from './reference-writer.js'
import type { ReferenceClient, ReferencePool } from './reference-writer.js'

interface DatanovaUpdate {
  inseeCom: string
  postalCodes: string[]
  libelleAcheminementWithPostalCodes: Record<string, string>
}

export interface DatanovaUpdateResult {
  inseeCom: string
  updatedRowsCount: number
  error?: string
}

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const invalid = () => new PostalReferenceError('invalid-reference', 'Invalid postal update')

function checkFields(item: Record<string, unknown>, fields: string[]) {
  if (Object.keys(item).some(key => !fields.includes(key))
    || (item.updatedBy !== undefined && (typeof item.updatedBy !== 'string'
      || !item.updatedBy.trim() || item.updatedBy.length > 255))
    || (item.updateNote !== undefined && (typeof item.updateNote !== 'string'
      || item.updateNote.length > 2000))) throw invalid()
}

export function parseDatanovaUpdates(input: unknown): DatanovaUpdate[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 100) throw invalid()
  const seen = new Set<string>()
  return input.map(item => {
    if (!record(item) || !isPostalCog(item.inseeCom)) throw invalid()
    checkFields(item, [
      'inseeCom', 'postalCodes', 'libelleAcheminementWithPostalCodes', 'updatedBy', 'updateNote',
    ])
    if (seen.has(item.inseeCom)) throw invalid()
    seen.add(item.inseeCom)
    const codes = item.postalCodes
    const labels = item.libelleAcheminementWithPostalCodes
    if (!Array.isArray(codes) || codes.length === 0 || codes.length > 1000
      || !codes.every(isPostalCode) || new Set(codes).size !== codes.length
      || !record(labels) || Object.keys(labels).length !== codes.length
      || !codes.every(code => Object.hasOwn(labels, code) && isPostalLabel(labels[code]))) {
      throw invalid()
    }
    return {
      inseeCom: item.inseeCom,
      postalCodes: [...codes].sort(),
      libelleAcheminementWithPostalCodes: Object.fromEntries(
        codes.map(code => [code, (labels[code] as string).trim()]),
      ),
    }
  })
}

async function transaction<T>(
  pool: ReferencePool,
  operation: (client: ReferenceClient) => Promise<T>,
) {
  let client: ReferenceClient | undefined
  let commitStarted = false
  let discard: Error | undefined
  try {
    client = await pool.connect()
    await client.query('BEGIN')
    await client.query(`SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '120s';
      ${postalPublicationLock}`)
    const result = await operation(client)
    commitStarted = true
    await client.query('COMMIT')
    return result
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK') } catch { discard = new Error('Discard postal client') }
    }
    if (commitStarted) {
      discard = new Error('Discard uncertain postal client')
      throw new PostalReferenceError('publication-unknown', 'Postal publication outcome is unknown')
    }
    if (error instanceof PostalReferenceError) throw error
    throw new PostalReferenceError('storage', 'Postal reference operation failed')
  } finally {
    client?.release(discard)
  }
}

export async function updatePostalDatanova(pool: ReferencePool, input: unknown) {
  // Validate the whole request before its first write; existing-row updates remain per item.
  const items = parseDatanovaUpdates(input)
  const results: DatanovaUpdateResult[] = []
  for (const item of items) {
    try {
      const updatedRowsCount = await transaction(pool, async client => {
        const { rows } = await client.query(`UPDATE postal.datanova
          SET "postalCodes" = $2, "libelleAcheminementWithPostalCodes" = $3::jsonb,
            "updatedAt" = now()
          WHERE "inseeCom" = $1 RETURNING id`, [item.inseeCom, item.postalCodes,
          JSON.stringify(item.libelleAcheminementWithPostalCodes)])
        if (rows.length > 1) {
          throw new PostalReferenceError('storage', 'Postal update failed')
        }
        return rows.length
      })
      results.push({ inseeCom: item.inseeCom, updatedRowsCount })
    } catch (error) {
      if (error instanceof PostalReferenceError && error.kind === 'publication-unknown') throw error
      results.push({ inseeCom: item.inseeCom, updatedRowsCount: 0, error: 'Database update failed' })
    }
  }
  return results
}
