import { describe, expect, it, vi } from 'vitest'

import type { FileKind } from './context.js'
import { createReference, currentReference, loadReference } from './reference.js'

const bytes = (value: unknown) => Buffer.from(JSON.stringify(value))
const commune = {
  code: '96001', nom: 'COMMUNE FICTIVE', type: 'commune-actuelle',
  departement: '96', region: '99', population: 0, codesPostaux: [],
}
const files = (communes: unknown[] = [commune]): Record<FileKind, Uint8Array> => ({
  communes: bytes(communes),
  departements: bytes([{ code: '96', nom: 'DEPARTEMENT FICTIF' }]),
  regions: bytes([{ code: '99', nom: 'REGION FICTIVE' }]),
})

describe('versioned administrative reference', () => {
  it('maps known source fields, preserves labels separately and never mutates the input', () => {
    const input = files([{ ...commune, labels: ['NOT A BUSINESS LABEL'], ignored: true }])
    const contents = () => Object.fromEntries(
      Object.entries(input).map(([kind, data]) => [kind, Array.from(data)]),
    )
    const original = contents()
    const loaded = createReference(currentReference, input)
    const resolved = loaded.resolve('96001')
    expect(resolved).toMatchObject({ status: 'found', context: {
      code: '96001', name: 'COMMUNE FICTIVE', type: 'commune-actuelle',
      department: { code: '96', name: 'DEPARTEMENT FICTIF' },
      region: { code: '99', name: 'REGION FICTIVE' }, population: 0, postalCodes: [],
    } })
    expect(resolved).not.toHaveProperty('context.labels')
    expect(contents()).toEqual(original)
    expect(loaded.reference.files.communes.sha256).toHaveLength(64)
  })

  it('reports unknown and ambiguous codes without guessing a parent or a commune type', () => {
    const loaded = createReference(currentReference, files([
      commune, { ...commune, type: 'commune-deleguee' },
    ]))
    expect(loaded.resolve('96099')).toEqual({ status: 'missing' })
    expect(loaded.resolve('96001')).toEqual({ status: 'ambiguous' })
    expect(loaded.resolve('96001', 'commune-actuelle').status).toBe('found')
    expect(loaded.resolve('96001', 'unknown-type')).toEqual({ status: 'missing' })
  })

  it('keeps optional absent fields absent and returns detached resolution values', () => {
    const loaded = createReference(currentReference, files([
      { code: '96002', nom: 'AUTRE FICTIVE', type: 'commune-actuelle' },
    ]))
    const found = loaded.resolve('96002')
    expect(found).toMatchObject({ status: 'found' })
    if (found.status !== 'found') throw new Error('Expected synthetic context')
    expect(found.context).not.toHaveProperty('population')
    found.context.name = 'CHANGED BY CALLER'
    expect(loaded.resolve('96002')).toHaveProperty('context.name', 'AUTRE FICTIVE')
  })

  it.each([
    [], [{ ...commune, population: '0' }], [{ ...commune, codesPostaux: ['bad'] }],
    [{ ...commune, departement: '95' }], [{ ...commune, nom: '' }],
  ].map(communes => ({ communes })))
    ('rejects invalid or incomplete source records %#', ({ communes }) => {
    expect(() => createReference(currentReference, files(communes))).toThrow()
  })

  it('refuses duplicate area keys and changed bytes when a checksum is pinned', () => {
    const input = files()
    const loaded = createReference(currentReference, input)
    expect(createReference({ ...currentReference, expectedSha256: loaded.sha256 }, input).sha256)
      .toBe(loaded.sha256)
    expect(() => createReference({ ...currentReference, expectedSha256: 'f'.repeat(64) }, input))
      .toThrow('Reference checksum mismatch')
    input.departements = bytes([
      { code: '96', nom: 'UN FICTIF' }, { code: '96', nom: 'AUTRE FICTIF' },
    ])
    expect(() => createReference(currentReference, input)).toThrow('Duplicate reference area')
  })

  it('fetches versioned allowlisted URLs with bounded requests and no redirects', async () => {
    const data = files()
    const request = vi.fn<typeof fetch>(async url => {
      const kind = /\/(communes|departements|regions)\.json$/.exec(String(url))?.[1] as FileKind
      return new Response(Buffer.from(data[kind]))
    })
    const loaded = await loadReference(currentReference, request)
    expect(loaded.resolve('96001').status).toBe('found')
    expect(request).toHaveBeenCalledTimes(3)
    for (const [url, options] of request.mock.calls) {
      expect(String(url)).toMatch(/^https:\/\/unpkg.com\/@etalab\/decoupage-administratif@6\.0\.0/)
      expect(options?.redirect).toBe('error')
      expect(options?.signal).toBeInstanceOf(AbortSignal)
    }
  })

  it('rejects malformed versions before fetching and propagates HTTP failures', async () => {
    const request = vi.fn<typeof fetch>()
    await expect(loadReference({ ...currentReference, version: '../private' }, request))
      .rejects.toThrow()
    expect(request).not.toHaveBeenCalled()
    request.mockResolvedValue(new Response('unavailable', { status: 503 }))
    await expect(loadReference(currentReference, request)).rejects.toThrow('unavailable')
    expect(request).toHaveBeenCalledTimes(1)
  })

  it('bounds declared and streamed size, rejects invalid UTF-8 and malformed JSON', async () => {
    const request = vi.fn<typeof fetch>()
    request.mockResolvedValueOnce(new Response('[]', {
      headers: { 'content-length': String(21 * 1024 * 1024) },
    }))
    await expect(loadReference(currentReference, request)).rejects.toThrow('too large')
    request.mockImplementationOnce(async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(21 * 1024 * 1024))
        controller.close()
      },
    })))
    await expect(loadReference(currentReference, request)).rejects.toThrow('too large')
    expect(() => createReference(currentReference, {
      ...files(), communes: new Uint8Array([0xff]),
    })).toThrow()
    expect(() => createReference(currentReference, {
      ...files(), communes: Buffer.from('{invalid'),
    })).toThrow()
  })
})
