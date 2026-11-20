import { describe, expect, it, vi } from 'vitest'

import { parseCommand, runCommand } from './command.js'
import { createReference, currentReference } from './reference.js'

const id = '11111111-1111-4111-8111-111111111101'
const bytes = (value: unknown) => Buffer.from(JSON.stringify(value))
const loaded = createReference(currentReference, {
  communes: bytes([{ code: '96001', nom: 'FICTIVE', type: 'commune-actuelle' }]),
  departements: bytes([{ code: '96', nom: 'DEPARTEMENT FICTIF' }]),
  regions: bytes([{ code: '99', nom: 'REGION FICTIVE' }]),
})
const command = parseCommand(['refresh', '--district', id])
const district = { cog: '96001', active: true }
const dependencies = () => ({ repository: {
  read: vi.fn().mockResolvedValue(district), save: vi.fn().mockResolvedValue('updated'),
}, load: vi.fn().mockResolvedValue(loaded) })

describe('district CLI contract', () => {
  it('defaults to a dry run and pins the verified reference version and millesime', () => {
    expect(command).toMatchObject({ action: 'refresh', district: id, apply: false,
      reference: { version: '6.0.0', millesime: '2026' } })
    expect(parseCommand(['refresh', '--district', id, '--apply']).apply).toBe(true)
    expect(parseCommand(['read', '--district', id]).action).toBe('read')
  })

  it.each([
    [], ['refresh'], ['refresh', '--district', 'invalid'], ['refresh', '--district', id, '--other'],
    ['read', '--district', id, '--apply'], ['read', '--district', id, '--type', 'commune-actuelle'],
    ['refresh', '--district', id, '--apply', '--apply'],
    ['refresh', '--district', id, '--district', id],
    ['refresh', '--district', id, '--reference-version', '../private'],
    ['refresh', '--district', id, '--reference-version', '7.0.0'],
    ['refresh', '--district', id, '--reference-sha256', 'invalid'],
    ['refresh', '--district', id, '--millesime', '2025'],
  ].map(args => ({ args })))
    ('rejects invalid commands without starting an operation %#', ({ args }) => {
    expect(() => parseCommand(args)).toThrow()
  })

  it('permits an explicitly versioned future source without inferring its millesime', () => {
    expect(parseCommand(['refresh', '--district', id, '--reference-version', '7.0.0',
      '--millesime', '2027', '--reference-sha256', 'a'.repeat(64)]).reference)
      .toEqual({ version: '7.0.0', millesime: '2027', expectedSha256: 'a'.repeat(64) })
  })

  it('reports planned/applied updates with the pinned source identity', async () => {
    const deps = dependencies()
    expect(await runCommand(command, deps)).toMatchObject({ mode: 'dry-run', status: 'updated',
      referenceSha256: loaded.sha256, context: { code: '96001' } })
    expect(deps.repository.save).toHaveBeenCalledWith(id, '96001', expect.objectContaining({
      sourceCog: '96001', reference: loaded.reference,
    }), false)
    expect(await runCommand({ ...command, apply: true }, deps))
      .toMatchObject({ mode: 'apply', status: 'updated' })
    expect(deps.repository.save.mock.calls.at(-1)?.[3]).toBe(true)
  })

  it('does not fetch for absent, inactive or unidentified districts', async () => {
    for (const value of [undefined, { ...district, active: false }, { ...district, cog: null }]) {
      const deps = dependencies()
      deps.repository.read.mockResolvedValue(value)
      const result = await runCommand(command, deps)
      expect(['missing', 'stale']).toContain(result.status)
      expect(deps.load).not.toHaveBeenCalled()
      expect(deps.repository.save).not.toHaveBeenCalled()
    }
  })

  it('leaves an existing context intact when the source is missing or ambiguous', async () => {
    for (const status of ['missing', 'ambiguous']) {
      const deps = dependencies()
      deps.load.mockResolvedValue({ ...loaded, resolve: () => ({ status }) })
      expect(await runCommand(command, deps)).toMatchObject({ status })
      expect(deps.repository.save).not.toHaveBeenCalled()
    }
  })

  it('reads stored content without fetching and refuses a context for another COG', async () => {
    const resolved = loaded.resolve('96001')
    if (resolved.status !== 'found') throw new Error('Expected synthetic context')
    const stored = { sourceCog: '96001', reference: loaded.reference,
      context: resolved.context, contentHash: resolved.contentHash }
    const deps = dependencies()
    deps.repository.read.mockResolvedValue({ ...district, stored })
    const read = { ...command, action: 'read' as const }
    expect(await runCommand(read, deps)).toMatchObject({ status: 'unchanged', ...stored })
    deps.repository.read.mockResolvedValue({ ...district, cog: '96002', stored })
    const result = await runCommand(read, deps)
    expect(result).toMatchObject({ status: 'stale', reason: 'district-cog-changed' })
    expect(result).not.toHaveProperty('context')
    deps.repository.read.mockResolvedValue(district)
    expect(await runCommand(read, deps)).toMatchObject({ status: 'missing' })
    expect(deps.load).not.toHaveBeenCalled()
    expect(deps.repository.save).not.toHaveBeenCalled()
  })

  it('reports a concurrent district change without claiming persistence', async () => {
    const deps = dependencies()
    deps.repository.save.mockResolvedValue('stale')
    const result = await runCommand({ ...command, apply: true }, deps)
    expect(result.status).toBe('stale')
    expect(result).not.toHaveProperty('context')
  })

  it('does not expose raw SQL, URLs, payloads or secrets for failed work', async () => {
    for (const target of ['load', 'save', 'read'] as const) {
      const deps = dependencies()
      const failure = new Error('private SQL or credential-bearing URI')
      if (target === 'load') deps.load.mockRejectedValue(failure)
      else deps.repository[target].mockRejectedValue(failure)
      const result = await runCommand(command, deps)
      expect(result.status).toBe('failed')
      expect(JSON.stringify(result)).not.toContain(failure.message)
    }
  })
})
