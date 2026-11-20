import { createHash } from 'node:crypto'
import { Readable, Transform } from 'node:stream'
import type { Duplex } from 'node:stream'
import { finished, pipeline } from 'node:stream/promises'

import { parse } from 'csv-parse'
import { parser } from 'stream-json/parser.js'
import type { Token } from 'stream-json/parser.js'
import FlexAssembler from 'stream-json/utils/flex-assembler.js'

import { PostalReferenceError, writePostalReferences } from './reference-writer.js'
import type { ReferencePool, ReferenceSink } from './reference-writer.js'

export interface PostalSources {
  datanova: Readable
  areas: Readable
  sourceSrid: 2154 | 4326
  delimiter?: ';' | ','
}

interface SourceDigest {
  bytes: number
  records: number
  sha256: string
}

interface ReadOptions {
  signal?: AbortSignal
  limits?: { sourceBytes?: number; featureCost?: number; packedLength?: number }
}

const invalid = (message: string) => new PostalReferenceError('invalid-reference', message)
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const digest = (): SourceDigest => ({ bytes: 0, records: 0, sha256: '' })

/** Cover unopened inputs too; keep listeners until delayed error/close events have settled. */
function guardSources(sources: PostalSources) {
  const streams = [sources.datanova, sources.areas]
  let failure: unknown
  let closing = false
  const remember = (error: unknown) => {
    if (closing || failure) return
    failure = error
    for (const stream of streams) stream.destroy(error instanceof Error ? error : undefined)
  }
  for (const stream of streams) stream.on('error', remember)
  const settled = streams.map(stream => finished(stream, { cleanup: true }).catch(remember))
  for (const stream of streams) if (stream.errored) remember(stream.errored)
  return {
    check() { if (failure) throw invalid('Unable to read or decode postal sources') },
    async close() {
      closing = true
      for (const stream of streams) stream.destroy()
      await Promise.all(settled)
      for (const stream of streams) stream.removeListener('error', remember)
    },
  }
}

/** Connects byte streams with backpressure, fatal UTF-8 validation and bounded input. */
async function* decoded(
  source: Readable,
  decoder: Duplex,
  report: SourceDigest,
  options: ReadOptions,
): AsyncGenerator<unknown> {
  const hash = createHash('sha256')
  const utf8 = new TextDecoder('utf-8', { fatal: true })
  const maximum = options.limits?.sourceBytes ?? 8_000_000_000
  const meter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      try {
        report.bytes += chunk.length
        if (report.bytes > maximum) throw invalid('Postal source is too large')
        utf8.decode(chunk, { stream: true })
        hash.update(chunk)
        callback(null, chunk)
      } catch { callback(invalid('Postal source exceeds limits or is not UTF-8')) }
    },
    flush(callback) {
      try { utf8.decode(); callback() } catch { callback(invalid('Invalid postal source UTF-8')) }
    },
  })
  let failure: unknown
  const finished = pipeline(source, meter, decoder, { signal: options.signal })
    .catch(error => { failure = error })
  try {
    for await (const item of decoder) yield item as unknown
    await finished
    if (failure) throw failure
    report.sha256 = hash.digest('hex')
  } finally {
    source.destroy()
    meter.destroy()
    decoder.destroy()
    await finished
  }
}

async function readDatanova(
  source: Readable, sink: ReferenceSink, report: SourceDigest,
  delimiter: ';' | ',', options: ReadOptions,
) {
  const csv = parse({
    bom: true, delimiter, skip_empty_lines: true, trim: true, max_record_size: 1_000_000,
    columns(headers: string[]) {
      const normalized = headers.map(header => header.normalize('NFD')
        .replace(/\p{M}/gu, '').trim().toLowerCase().replace(/\s+/gu, '_'))
      if (normalized.length > 100 || normalized.some(name => !name || name.length > 128)
        || new Set(normalized).size !== normalized.length
        || ['code_commune_insee', 'code_postal', 'libelle_d_acheminement']
          .some(required => !normalized.includes(required))) {
        throw invalid('Invalid Datanova CSV header')
      }
      return normalized
    },
  })
  for await (const row of decoded(source, csv, report, options)) {
    if (!record(row) || ['code_commune_insee', 'code_postal', 'libelle_d_acheminement']
      .some(key => typeof row[key] !== 'string')) throw invalid('Invalid Datanova CSV record')
    report.records++
    await sink.code({ cog: String(row.code_commune_insee).trim().toUpperCase(),
      code: String(row.code_postal).trim(), label: String(row.libelle_d_acheminement) })
  }
  if (!report.records) throw invalid('Empty Datanova CSV')
}

function validateCrs(value: unknown, sourceSrid: number) {
  if (value === null) return
  if (!record(value) || value.type !== 'name' || !record(value.properties)
    || typeof value.properties.name !== 'string') throw invalid('Unsupported GeoJSON CRS')
  const name = value.properties.name
  const match = /^(?:EPSG:|urn:ogc:def:crs:EPSG::)(2154|4326)$/.exec(name)
  const srid = match ? Number(match[1])
    : name === 'urn:ogc:def:crs:OGC:1.3:CRS84' ? 4326 : undefined
  if (srid !== sourceSrid) throw invalid('GeoJSON CRS contradicts the declared source SRID')
}

function assembler() {
  return new FlexAssembler<unknown>({ maxDepth: 32, objectRules: [{
    filter: () => true,
    create: () => Object.create(null) as Record<string, unknown>,
    add(container, key, value) {
      if (!record(container) || Object.hasOwn(container, key)) {
        throw invalid('Duplicate GeoJSON object key')
      }
      container[key] = value
    },
  }] })
}

async function readAreas(
  source: Readable, sink: ReferenceSink, report: SourceDigest,
  sourceSrid: 2154 | 4326, options: ReadOptions,
) {
  const json = parser.asStream({ streamValues: false, maxDepth: 32,
    maxPackedLength: options.limits?.packedLength ?? 1_000_000 })
  let depth = 0
  let started = false
  let complete = false
  let rootKey = ''
  let awaitingValue = false
  let collectionType: unknown
  let features = false
  let insideFeatures = false
  const rootKeys = new Set<string>()
  let capture: { kind: 'feature' | 'crs'; value: FlexAssembler<unknown>; cost: number } | undefined
  for await (const raw of decoded(source, json, report, options)) {
    const token = raw as Token
    if ('value' in token && typeof token.value === 'string'
      && token.value.length > (options.limits?.packedLength ?? 1_000_000)) {
      throw invalid('GeoJSON scalar value is too large')
    }
    const open = token.name === 'startArray' || token.name === 'startObject'
    const close = token.name === 'endArray' || token.name === 'endObject'
    if (!started) {
      if (token.name !== 'startObject') throw invalid('Expected GeoJSON FeatureCollection')
      started = true
      depth = 1
      continue
    }
    if (token.name === 'keyValue' && token.value.length > 512) {
      throw invalid('GeoJSON object key is too long')
    }
    if (!capture && depth === 1 && token.name === 'keyValue') {
      if (rootKeys.has(token.value) || rootKeys.size >= 1000) {
        throw invalid('Duplicate or excessive GeoJSON root keys')
      }
      rootKeys.add(token.value)
      rootKey = token.value
      awaitingValue = true
      continue
    }
    if (!capture && depth === 1 && awaitingValue) {
      awaitingValue = false
      if (rootKey === 'type') {
        if (token.name !== 'stringValue') throw invalid('Invalid GeoJSON collection type')
        collectionType = token.value
      } else if (rootKey === 'features') {
        if (token.name !== 'startArray') throw invalid('Expected GeoJSON features array')
        features = true
        insideFeatures = true
      } else if (rootKey === 'crs') {
        capture = { kind: 'crs', value: assembler(), cost: 0 }
      }
    } else if (!capture && insideFeatures && depth === 2 && token.name !== 'endArray') {
      if (token.name !== 'startObject') throw invalid('Expected GeoJSON Feature')
      capture = { kind: 'feature', value: assembler(), cost: 0 }
    }
    if (capture) {
      capture.cost += 16 + ('value' in token && typeof token.value === 'string'
        ? Buffer.byteLength(token.value) : 0)
      if (capture.cost > (capture.kind === 'crs' ? 16_000
        : options.limits?.featureCost ?? 32_000_000)) throw invalid('GeoJSON feature too large')
      capture.value.consume(token)
      if (capture.value.done) {
        const value = capture.value.current
        if (capture.kind === 'crs') validateCrs(value, sourceSrid)
        else {
          if (!record(value) || value.type !== 'Feature' || !record(value.properties)
            || !record(value.geometry) || typeof value.properties.cp !== 'string'
            || typeof value.properties.insee_com !== 'string') {
            throw invalid('Invalid GeoJSON postal Feature')
          }
          if (Object.hasOwn(value, 'crs')) validateCrs(value.crs, sourceSrid)
          if (Object.hasOwn(value.geometry, 'crs')) validateCrs(value.geometry.crs, sourceSrid)
          report.records++
          await sink.area({ cog: value.properties.insee_com.trim().toUpperCase(),
            code: value.properties.cp.trim(), geometry: value.geometry, sourceSrid })
        }
        capture = undefined
      }
    }
    if (insideFeatures && depth === 2 && token.name === 'endArray') insideFeatures = false
    if (open) depth++
    if (close) depth--
    if (depth === 0) complete = true
  }
  if (!complete || collectionType !== 'FeatureCollection' || !features || !report.records) {
    throw invalid('Expected nonempty GeoJSON FeatureCollection')
  }
}

/** Reads only explicit streams; no downloads, filesystem access or connections at import. */
export async function loadPostalSources(
  sources: PostalSources, sink: ReferenceSink, options: ReadOptions = {},
) {
  const guard = guardSources(sources)
  const datanova = digest()
  const areas = digest()
  try {
    guard.check()
    if (![2154, 4326].includes(sources.sourceSrid)
      || ![';', ','].includes(sources.delimiter ?? ';')) throw invalid('Invalid postal source options')
    await readDatanova(sources.datanova, sink, datanova, sources.delimiter ?? ';', options)
    guard.check()
    await readAreas(sources.areas, sink, areas, sources.sourceSrid, options)
    guard.check()
    return { datanova, areas }
  } catch (error) {
    if (error instanceof PostalReferenceError) throw error
    throw invalid('Unable to read or decode postal sources')
  } finally {
    await guard.close()
  }
}

export async function importPostalReferences(
  pool: ReferencePool, sources: PostalSources, options: ReadOptions & { apply?: boolean } = {},
) {
  const guard = guardSources(sources)
  let input: Awaited<ReturnType<typeof loadPostalSources>> | undefined
  try {
    const report = await writePostalReferences(pool, async sink => {
      guard.check()
      input = await loadPostalSources(sources, sink, options)
      guard.check()
    }, options)
    return { ...report, sources: input! }
  } finally {
    await guard.close()
  }
}
