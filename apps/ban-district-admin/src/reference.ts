import { z } from 'zod'

import {
  cogSchema,
  communeTypeSchema,
  contentHash,
  fileKinds,
  millesimeSchema,
  referenceSchema,
  referenceUrl,
  sha256,
  sha256Schema,
  sourceAreaSchema,
  sourceCommuneSchema,
  versionSchema,
} from './context.js'
import type { AdministrativeContext, AdministrativeReference, FileKind } from './context.js'

export const currentReference = { version: '6.0.0', millesime: '2026' } as const
const maximumBytes = 20 * 1024 * 1024
const sourceCommuneList = z.array(sourceCommuneSchema).min(1).max(100000)
const sourceAreaList = z.array(sourceAreaSchema).min(1).max(1000)

export interface ReferenceInput {
  version: string
  millesime: string
  expectedSha256?: string
}

export type Resolution =
  | { status: 'found'; context: AdministrativeContext; contentHash: string }
  | { status: 'missing' | 'ambiguous' }

export interface LoadedReference {
  reference: AdministrativeReference
  sha256: string
  resolve(code: string, type?: string): Resolution
}

function parseJson(bytes: Uint8Array) {
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) as unknown
}

export function createReference(
  input: ReferenceInput,
  files: Record<FileKind, Uint8Array>,
): LoadedReference {
  versionSchema.parse(input.version)
  millesimeSchema.parse(input.millesime)
  const entries = fileKinds.map(kind => [kind, {
    url: referenceUrl(input.version, kind), sha256: sha256(files[kind]),
  }])
  const reference = referenceSchema.parse({
    name: '@etalab/decoupage-administratif',
    version: input.version,
    millesime: input.millesime,
    files: Object.fromEntries(entries),
  })
  const digest = sha256(JSON.stringify(reference))
  if (input.expectedSha256 !== undefined) {
    sha256Schema.parse(input.expectedSha256)
    if (input.expectedSha256 !== digest) throw new Error('Reference checksum mismatch')
  }
  const communes = sourceCommuneList.parse(parseJson(files.communes))
  const departments = new Map<string, string>()
  const regions = new Map<string, string>()
  for (const [kind, target] of [
    ['departements', departments], ['regions', regions],
  ] as const) {
    for (const area of sourceAreaList.parse(parseJson(files[kind]))) {
      if (target.has(area.code)) throw new Error('Duplicate reference area')
      target.set(area.code, area.nom)
    }
  }
  const byCog = new Map<string, AdministrativeContext[]>()
  const area = (code: string, names: Map<string, string>) => {
    const name = names.get(code)
    if (!name) throw new Error('Missing administrative area')
    return { code, name }
  }
  for (const commune of communes) {
    const context: AdministrativeContext = {
      code: commune.code,
      name: commune.nom,
      type: commune.type,
      ...(commune.departement !== undefined && {
        department: area(commune.departement, departments),
      }),
      ...(commune.region !== undefined && { region: area(commune.region, regions) }),
      ...(commune.population !== undefined && { population: commune.population }),
      ...(commune.codesPostaux !== undefined && { postalCodes: commune.codesPostaux }),
    }
    const candidates = byCog.get(context.code) ?? []
    candidates.push(context)
    byCog.set(context.code, candidates)
  }
  return {
    reference,
    sha256: digest,
    resolve(code, type) {
      cogSchema.parse(code)
      if (type !== undefined) communeTypeSchema.parse(type)
      const candidates = (byCog.get(code) ?? [])
        .filter(item => type === undefined || item.type === type)
      if (candidates.length !== 1) {
        return { status: candidates.length === 0 ? 'missing' : 'ambiguous' }
      }
      const context = structuredClone(candidates[0])
      return { status: 'found', context, contentHash: contentHash(reference, context) }
    },
  }
}

export async function loadReference(input: ReferenceInput, request: typeof fetch = fetch) {
  versionSchema.parse(input.version)
  millesimeSchema.parse(input.millesime)
  const files = {} as Record<FileKind, Uint8Array>
  for (const kind of fileKinds) {
    const response = await request(referenceUrl(input.version, kind), {
      redirect: 'error', signal: AbortSignal.timeout(15000),
    })
    if (!response.ok || !response.body) throw new Error('Administrative reference unavailable')
    const length = response.headers.get('content-length')
    if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximumBytes)) {
      await response.body.cancel()
      throw new Error('Administrative reference too large')
    }
    const reader = response.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        size += value.byteLength
        if (size > maximumBytes) throw new Error('Administrative reference too large')
        chunks.push(value)
      }
    } catch (error) {
      await reader.cancel().catch(() => {})
      throw error
    } finally {
      reader.releaseLock()
    }
    files[kind] = Buffer.concat(chunks)
  }
  return createReference(input, files)
}
