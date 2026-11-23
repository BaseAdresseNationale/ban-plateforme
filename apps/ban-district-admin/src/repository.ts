import {
  cogSchema,
  contentHash,
  contextSchema,
  districtIdSchema,
  referenceSchema,
  sha256Schema,
} from './context.js'
import type { AdministrativeContext, AdministrativeReference } from './context.js'

interface QueryResult { rows: Record<string, unknown>[] }
export interface DatabaseClient {
  query(sql: string, values?: unknown[]): Promise<QueryResult>
  release(): void
}
export interface Database {
  query(sql: string, values?: unknown[]): Promise<QueryResult>
  connect(): Promise<DatabaseClient>
}

export interface StoredContext {
  sourceCog: string
  reference: AdministrativeReference
  context: AdministrativeContext
  contentHash: string
}

export interface DistrictState {
  cog: string | null
  active: boolean
  stored?: StoredContext
}

export const districtQuery = `
SELECT d.meta->'insee'->>'cog' AS cog, d."isActive" AS active,
  c.source_cog, c.reference, c.context, c.content_hash
FROM ban.district d
LEFT JOIN district_admin.context c ON c.district_id = d.id
WHERE d.id = $1::uuid`

export const lockDistrictQuery =
  'SELECT cog, active FROM district_admin.lock_district($1::uuid)'
const storedQuery = `
SELECT source_cog, reference, context, content_hash
FROM district_admin.context WHERE district_id = $1::uuid`

const upsertQuery = `
INSERT INTO district_admin.context
  (district_id, source_cog, reference, context, content_hash)
VALUES ($1::uuid, $2, $3::jsonb, $4::jsonb, $5)
ON CONFLICT (district_id) DO UPDATE SET
  source_cog = EXCLUDED.source_cog, reference = EXCLUDED.reference,
  context = EXCLUDED.context, content_hash = EXCLUDED.content_hash, recorded_at = now()
WHERE district_admin.context.content_hash IS DISTINCT FROM EXCLUDED.content_hash`

function parseState(row: Record<string, unknown> | undefined): DistrictState | undefined {
  if (!row) return undefined
  const cog = row.cog === null ? null : cogSchema.parse(row.cog)
  if (typeof row.active !== 'boolean') throw new Error('Invalid district activity')
  if (row.source_cog === null) return { cog, active: row.active }
  const reference = referenceSchema.parse(row.reference)
  const context = contextSchema.parse(row.context)
  const sourceCog = cogSchema.parse(row.source_cog)
  const digest = sha256Schema.parse(row.content_hash)
  if (context.code !== sourceCog || contentHash(reference, context) !== digest) {
    throw new Error('Invalid stored administrative context')
  }
  return { cog, active: row.active, stored: {
    sourceCog, reference, context, contentHash: digest,
  } }
}

export function createDistrictRepository(database: Database) {
  return {
    async read(id: string) {
      districtIdSchema.parse(id)
      const { rows } = await database.query(districtQuery, [id])
      return parseState(rows[0])
    },
    async save(id: string, expectedCog: string, payload: StoredContext, apply: boolean) {
      districtIdSchema.parse(id)
      cogSchema.parse(expectedCog)
      if (payload.sourceCog !== expectedCog || payload.context.code !== expectedCog
        || payload.contentHash !== contentHash(payload.reference, payload.context)) {
        throw new Error('Invalid context write')
      }
      referenceSchema.parse(payload.reference)
      contextSchema.parse(payload.context)
      const client = await database.connect()
      try {
        await client.query('BEGIN')
        await client.query("SET LOCAL statement_timeout = '10s'")
        await client.query("SET LOCAL lock_timeout = '5s'")
        const { rows: locked } = await client.query(lockDistrictQuery, [id])
        let district: DistrictState | undefined
        if (locked[0]) {
          // Une nouvelle instruction après le verrou voit le contexte d'un rejeu
          // concurrent terminé pendant l'attente, sans instantané périmé du JOIN.
          const { rows } = await client.query(storedQuery, [id])
          district = parseState({ ...locked[0], ...(rows[0] ?? { source_cog: null }) })
        }
        let status: 'missing' | 'stale' | 'unchanged' | 'updated'
        if (!district) status = 'missing'
        else if (!district.active || district.cog !== expectedCog) status = 'stale'
        else if (district.stored?.contentHash === payload.contentHash) status = 'unchanged'
        else {
          status = 'updated'
          if (apply) {
            await client.query(upsertQuery, [
              id, expectedCog, JSON.stringify(payload.reference),
              JSON.stringify(payload.context), payload.contentHash,
            ])
          }
        }
        await client.query('COMMIT')
        return status
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {})
        throw error
      } finally {
        client.release()
      }
    },
  }
}
export type DistrictRepository = ReturnType<typeof createDistrictRepository>
