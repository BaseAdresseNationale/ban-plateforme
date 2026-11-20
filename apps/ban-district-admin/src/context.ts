import { createHash } from 'node:crypto'

import { z } from 'zod'

export const cogSchema = z.string().length(5).regex(/^(?:[0-9]{5}|2[AB][0-9]{3})$/)
export const districtIdSchema = z.string().uuid()
const nameSchema = z.string().min(1).max(512).refine(value => value.trim().length > 0)
export const communeTypeSchema = z.string().min(1).max(80)
const areaCodeSchema = z.string().min(1).max(5).regex(/^[0-9A-Z]+$/)
const areaSchema = z.object({ code: areaCodeSchema, name: nameSchema }).strict()
export const sha256Schema = z.string().length(64).regex(/^[a-f0-9]+$/)
export const versionSchema = z.string().max(32).regex(/^\d+\.\d+\.\d+$/)
export const millesimeSchema = z.string().length(4).regex(/^\d{4}$/)
export const fileKinds = ['communes', 'departements', 'regions'] as const
export type FileKind = typeof fileKinds[number]

export const contextSchema = z.object({
  code: cogSchema,
  name: nameSchema,
  type: communeTypeSchema,
  department: areaSchema.optional(),
  region: areaSchema.optional(),
  population: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).optional(),
  postalCodes: z.array(z.string().length(5).regex(/^[0-9]{5}$/)).max(100).optional(),
}).strict()
export type AdministrativeContext = z.infer<typeof contextSchema>

const fileSchema = z.object({ url: z.string().max(256), sha256: sha256Schema }).strict()
export const referenceSchema = z.object({
  name: z.literal('@etalab/decoupage-administratif'),
  version: versionSchema,
  millesime: millesimeSchema,
  files: z.object({ communes: fileSchema, departements: fileSchema, regions: fileSchema }).strict(),
}).strict().superRefine((reference, issue) => {
  for (const kind of fileKinds) {
    if (reference.files[kind].url !== referenceUrl(reference.version, kind)) {
      issue.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid reference URL' })
    }
  }
})
export type AdministrativeReference = z.infer<typeof referenceSchema>

export function referenceUrl(version: string, kind: FileKind) {
  versionSchema.parse(version)
  return `https://unpkg.com/@etalab/decoupage-administratif@${version}/data/${kind}.json`
}

// Les objets sont canonisés ; l'ordre des tableaux reste celui de la source.
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
    const properties = entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
    return `{${properties.join(',')}}`
  }
  return JSON.stringify(value)
}

export function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex')
}

export function contentHash(reference: AdministrativeReference, context: AdministrativeContext) {
  return sha256(canonicalJson({ reference, context }))
}

export const sourceAreaSchema = z.object({ code: areaCodeSchema, nom: nameSchema })
export const sourceCommuneSchema = z.object({
  code: cogSchema,
  nom: nameSchema,
  type: communeTypeSchema,
  departement: areaCodeSchema.optional(),
  region: areaCodeSchema.optional(),
  population: contextSchema.shape.population,
  codesPostaux: contextSchema.shape.postalCodes,
})
