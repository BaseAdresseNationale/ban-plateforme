import {
  communeTypeSchema,
  districtIdSchema,
  millesimeSchema,
  sha256Schema,
  versionSchema,
} from './context.js'
import { currentReference, loadReference } from './reference.js'
import type { LoadedReference, ReferenceInput } from './reference.js'
import type { DistrictRepository } from './repository.js'

export interface DistrictCommand {
  action: 'refresh' | 'read'
  district: string
  apply: boolean
  type?: string
  reference: ReferenceInput
}

export function parseCommand(args: string[]): DistrictCommand {
  const [action, ...options] = args
  if (action !== 'refresh' && action !== 'read') throw new Error('Invalid district command')
  const values = new Map<string, string>()
  let apply = false
  for (let index = 0; index < options.length; index++) {
    const flag = options[index]
    if (flag === '--apply' && !apply) {
      apply = true
      continue
    }
    if (!['--district', '--type', '--reference-version', '--millesime', '--reference-sha256']
      .includes(flag) || values.has(flag)) throw new Error('Invalid district options')
    const value = options[++index]
    if (!value || value.startsWith('--')) throw new Error('Missing district option')
    values.set(flag, value)
  }
  if (action === 'read' && (apply || values.size !== 1 || !values.has('--district'))) {
    throw new Error('Read only accepts --district')
  }
  const version = values.get('--reference-version') ?? currentReference.version
  if (version !== currentReference.version && !values.has('--millesime')) {
    throw new Error('An explicit reference millesime is required')
  }
  if (version === currentReference.version && values.has('--millesime')
    && values.get('--millesime') !== currentReference.millesime) {
    throw new Error('Invalid millesime for the pinned current reference')
  }
  const type = values.get('--type')
  if (type !== undefined) communeTypeSchema.parse(type)
  const expectedSha256 = values.get('--reference-sha256')
  if (expectedSha256 !== undefined) sha256Schema.parse(expectedSha256)
  return {
    action,
    district: districtIdSchema.parse(values.get('--district')),
    apply,
    ...(type !== undefined && { type }),
    reference: {
      version: versionSchema.parse(version),
      millesime: millesimeSchema.parse(values.get('--millesime') ?? currentReference.millesime),
      ...(expectedSha256 !== undefined && { expectedSha256 }),
    },
  }
}

export interface CommandDependencies {
  repository: DistrictRepository
  load?: (input: ReferenceInput) => Promise<LoadedReference>
}

export async function runCommand(command: DistrictCommand, dependencies: CommandDependencies) {
  const mode = command.action === 'read' ? 'read' : command.apply ? 'apply' : 'dry-run'
  try {
    const district = await dependencies.repository.read(command.district)
    if (!district) return { mode, status: 'missing', reason: 'district-missing' }
    if (!district.active || !district.cog) {
      return { mode, status: 'stale', reason: 'inactive-or-unidentified-district' }
    }
    if (command.action === 'read') {
      if (!district.stored) return { mode, status: 'missing', reason: 'context-missing' }
      if (district.stored.sourceCog !== district.cog) {
        return { mode, status: 'stale', reason: 'district-cog-changed' }
      }
      return { mode, status: 'unchanged', ...district.stored }
    }
    let loaded: LoadedReference
    try { loaded = await (dependencies.load ?? loadReference)(command.reference) } catch {
      return { mode, status: 'failed', reason: 'reference-unavailable-or-invalid' }
    }
    const resolved = loaded.resolve(district.cog, command.type)
    const provenance = { reference: loaded.reference, referenceSha256: loaded.sha256 }
    if (resolved.status !== 'found') return { mode, status: resolved.status, ...provenance }
    const payload = {
      sourceCog: district.cog,
      reference: loaded.reference,
      context: resolved.context,
      contentHash: resolved.contentHash,
    }
    const status = await dependencies.repository.save(
      command.district, district.cog, payload, command.apply,
    )
    if (status === 'stale' || status === 'missing') return { mode, status, ...provenance }
    return { mode, status, context: resolved.context, ...provenance }
  } catch {
    return { mode, status: 'failed', reason: 'storage-unavailable-or-invalid' }
  }
}
