export type ReferenceFailure = 'invalid-reference' | 'storage' | 'publication-unknown'

export class PostalReferenceError extends Error {
  constructor(readonly kind: ReferenceFailure, message: string) {
    super(message)
    this.name = 'PostalReferenceError'
  }
}

export interface ReferenceClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
  release(error?: Error): void
}

export interface ReferencePool {
  connect(): Promise<ReferenceClient>
}

export interface PostalCodeReference {
  cog: string
  code: string
  label: string
}

export interface PostalAreaReference {
  cog: string
  code: string
  geometry: unknown
  sourceSrid: 2154 | 4326
}

export interface ReferenceSink {
  code(reference: PostalCodeReference): Promise<void>
  area(reference: PostalAreaReference): Promise<void>
}

export interface ReferenceReport {
  applied: boolean
  communes: number
  codes: number
  areas: number
}

const invalid = () => new PostalReferenceError('invalid-reference', 'Invalid postal reference')
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const validCog = (value: unknown): value is string => typeof value === 'string'
  && value.length === 5 && /^(?:[0-9]{5}|2[AB][0-9]{3})$/.test(value)
const validCode = (value: unknown): value is string => typeof value === 'string'
  && value.length === 5 && /^[0-9]{5}$/.test(value)

function geometryJson(input: unknown, srid: number): string {
  if (!record(input) || !['Polygon', 'MultiPolygon'].includes(String(input.type))) throw invalid()
  if (srid !== 2154 && srid !== 4326) throw invalid()
  const polygons = input.type === 'Polygon' ? [input.coordinates] : input.coordinates
  if (!Array.isArray(polygons) || polygons.length === 0) throw invalid()
  let points = 0
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || polygon.length === 0) throw invalid()
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) throw invalid()
      for (const point of ring) {
        if (++points > 1_000_000 || !Array.isArray(point) || point.length !== 2
          || point.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
          throw invalid()
        }
        const [x, y] = point as number[]
        if (srid === 4326 && (Math.abs(x) > 180 || Math.abs(y) > 90)) throw invalid()
        if (Math.abs(x) > 100_000_000 || Math.abs(y) > 100_000_000) throw invalid()
      }
      if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) throw invalid()
    }
  }
  const json = JSON.stringify({ type: input.type, coordinates: input.coordinates })
  if (Buffer.byteLength(json) > 16_000_000) throw invalid()
  return json
}

const prepareSql = `
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
CREATE TEMP TABLE ban_postal_candidate_code (
  cog text NOT NULL, code text NOT NULL, label text NOT NULL, PRIMARY KEY (cog, code)
) ON COMMIT DROP;
CREATE TEMP TABLE ban_postal_candidate_area (
  cog text NOT NULL, code text NOT NULL,
  geometry public.geometry(Geometry,2154) NOT NULL CHECK (
    public.ST_GeometryType(geometry) IN ('ST_Polygon','ST_MultiPolygon')
    AND public.ST_IsValid(geometry) AND NOT public.ST_IsEmpty(geometry)
  )
) ON COMMIT DROP;
`

const addCodeSql = `
INSERT INTO pg_temp.ban_postal_candidate_code AS candidate (cog, code, label)
VALUES ($1, $2, $3)
ON CONFLICT (cog, code) DO UPDATE SET label = candidate.label
WHERE candidate.label = EXCLUDED.label
RETURNING 1 AS accepted
`

const addAreaSql = `
INSERT INTO pg_temp.ban_postal_candidate_area (cog, code, geometry)
VALUES ($1, $2, public.ST_Transform(
  public.ST_SetSRID(public.ST_GeomFromGeoJSON($3), $4), 2154))
`

const inspectSql = `
SELECT (SELECT count(DISTINCT cog)::int FROM pg_temp.ban_postal_candidate_code) AS communes,
  (SELECT count(*)::int FROM pg_temp.ban_postal_candidate_code) AS codes,
  (SELECT count(*)::int FROM pg_temp.ban_postal_candidate_area) AS areas,
  EXISTS (
    SELECT 1 FROM pg_temp.ban_postal_candidate_area a
    WHERE NOT EXISTS (SELECT 1 FROM pg_temp.ban_postal_candidate_code c
      WHERE c.cog = a.cog AND c.code = a.code)
  ) AS inconsistent
`

const publishSql = `
SELECT pg_advisory_xact_lock(834, 12004);
LOCK TABLE postal.datanova, postal.postal_area IN SHARE ROW EXCLUSIVE MODE;
DELETE FROM postal.postal_area;
DELETE FROM postal.datanova;
INSERT INTO postal.datanova ("inseeCom", "postalCodes", "libelleAcheminementWithPostalCodes")
SELECT cog, array_agg(code ORDER BY code), jsonb_object_agg(code, label ORDER BY code)
FROM pg_temp.ban_postal_candidate_code GROUP BY cog;
INSERT INTO postal.postal_area ("inseeCom", "postalCode", geometry)
SELECT cog, code, geometry FROM pg_temp.ban_postal_candidate_area;
`

/** Candidate tables are private to this connection; live references change only at COMMIT. */
export async function writePostalReferences(
  pool: ReferencePool,
  load: (sink: ReferenceSink) => Promise<void>,
  options: { apply?: boolean; signal?: AbortSignal } = {},
): Promise<ReferenceReport> {
  let client: ReferenceClient | undefined
  let active = false
  let commitStarted = false
  let discard: Error | undefined
  const ensureActive = () => {
    options.signal?.throwIfAborted()
    if (!active) throw invalid()
  }
  try {
    options.signal?.throwIfAborted()
    client = await pool.connect()
    await client.query('BEGIN')
    await client.query(prepareSql)
    active = true
    let rows = 0
    await load({
      async code(value) {
        ensureActive()
        if (++rows > 2_000_000 || !validCog(value.cog) || !validCode(value.code)
          || typeof value.label !== 'string' || !value.label.trim() || value.label.length > 512
          || /[\u0000-\u001f\u007f\ud800-\udfff]/u.test(value.label)) throw invalid()
        let accepted: Record<string, unknown>[]
        try {
          const result = await client!.query(addCodeSql, [value.cog, value.code, value.label.trim()])
          accepted = result.rows
        } catch {
          throw new PostalReferenceError('storage', 'Postal reference operation failed')
        }
        if (accepted.length !== 1) {
          throw new PostalReferenceError('invalid-reference', 'Conflicting postal labels')
        }
      },
      async area(value) {
        ensureActive()
        if (++rows > 2_000_000 || !validCog(value.cog) || !validCode(value.code)) throw invalid()
        const geometry = geometryJson(value.geometry, value.sourceSrid)
        try {
          await client!.query(addAreaSql, [value.cog, value.code, geometry, value.sourceSrid])
        } catch (error) {
          if (record(error) && error.code === '23514') throw invalid()
          throw new PostalReferenceError('storage', 'Postal reference operation failed')
        }
      },
    })
    active = false
    options.signal?.throwIfAborted()
    const { rows: [result] } = await client.query(inspectSql)
    if (!result || !Number.isSafeInteger(result.communes) || Number(result.communes) <= 0
      || !Number.isSafeInteger(result.codes) || Number(result.codes) <= 0
      || !Number.isSafeInteger(result.areas) || Number(result.areas) <= 0
      || result.inconsistent !== false) throw invalid()
    const report = { applied: options.apply === true, communes: Number(result.communes),
      codes: Number(result.codes), areas: Number(result.areas) }
    if (report.applied) {
      await client.query(publishSql)
      options.signal?.throwIfAborted()
      commitStarted = true
      await client.query('COMMIT')
    } else {
      await client.query('ROLLBACK')
    }
    return report
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK') } catch { discard = new Error('Discard reference client') }
    }
    if (commitStarted) {
      throw new PostalReferenceError('publication-unknown', 'Postal publication outcome is unknown')
    }
    if (error instanceof PostalReferenceError) throw error
    throw new PostalReferenceError('storage', 'Postal reference operation failed')
  } finally {
    active = false
    client?.release(discard)
  }
}
