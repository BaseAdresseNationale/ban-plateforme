import type { PostalInput, PostalSnapshot } from './lookup.js'

export interface PostalDatabase {
  query(sql: string, values: unknown[]): Promise<{ rows: Record<string, unknown>[] }>
}

export const communeQuery = `
SELECT EXISTS (SELECT 1 FROM postal.datanova) AS available,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'code', code, 'label', d."libelleAcheminementWithPostalCodes" -> code
    ) ORDER BY code)
    FROM postal.datanova d CROSS JOIN LATERAL unnest(d."postalCodes") AS code
    WHERE d."inseeCom" = $1
  ), '[]'::jsonb) AS matches
`

// Consultation ponctuelle de #749 : aucun tampon historique BAN/ID-Fix de 10 mètres.
export const pointQuery = `
WITH point AS (
  SELECT public.ST_Transform(public.ST_SetSRID(public.ST_MakePoint(
    $2::double precision, $3::double precision
  ), 4326), 2154) AS geometry
), matches AS (
  SELECT DISTINCT a."postalCode" AS code,
    d."libelleAcheminementWithPostalCodes" -> a."postalCode" AS label
  FROM postal.postal_area a CROSS JOIN point p
  LEFT JOIN postal.datanova d ON d."inseeCom" = a."inseeCom"
  WHERE ($1::text IS NULL OR a."inseeCom" = $1)
    AND a.geometry && p.geometry AND public.ST_Contains(a.geometry, p.geometry)
  ORDER BY code, label LIMIT 2
)
SELECT (EXISTS (SELECT 1 FROM postal.datanova)
  AND EXISTS (SELECT 1 FROM postal.postal_area)) AS available,
  COALESCE((SELECT jsonb_agg(jsonb_build_object('code', code, 'label', label)
    ORDER BY code, label) FROM matches), '[]'::jsonb) AS matches
`

export function createPostalRepository(database: PostalDatabase) {
  return async (input: PostalInput): Promise<PostalSnapshot> => {
    const { rows } = await database.query(
      input.position ? pointQuery : communeQuery,
      input.position
        ? [input.inseeCom ?? null, input.position.long, input.position.lat]
        : [input.inseeCom],
    )
    const row = rows[0]
    if (!row || typeof row.available !== 'boolean' || !Array.isArray(row.matches)) {
      throw new Error('Invalid postal reference response')
    }
    const matches = row.matches.map((match: unknown) => {
      if (!match || typeof match !== 'object' || !('code' in match) || !('label' in match)
        || typeof match.code !== 'string' || match.code.length !== 5 || !/^\d{5}$/.test(match.code)
        || (match.label !== null && typeof match.label !== 'string')) {
        throw new Error('Invalid postal reference response')
      }
      return { code: match.code, label: match.label }
    })
    return { available: row.available, matches }
  }
}
