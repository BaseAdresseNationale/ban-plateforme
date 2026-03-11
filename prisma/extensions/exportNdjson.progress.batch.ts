// exportNdjson.progress.ts
// NDJSON v1 exporter with optional auto pagination + progress meta lines.
// PERF PATCH: batch snapshot loading (2 queries per page) instead of per-id timeline.at().
//
// Assumes your Prisma client has the BAN extensions installed, exposing:
// - prisma.timeline.address.diffWindow(...)
// - prisma.timeline.common_toponym.diffWindow(...)
// - prisma.timeline.district.diffWindow(...)

import { Prisma, type PrismaClient } from '../../generated/client/client.js'

/** Keep these local to avoid hard-coupling to your rangeValidity module exports. */
export type AtInput = Date | string

export type WindowGeoFilter =
  | { kind: 'france' }
  | { kind: 'commune'; cog: string }
  | { kind: 'departement'; dep: string }

export type PrismaClientWithTimeline = PrismaClient & {
  timeline: {
    exportNdjson: typeof exportNdjson
    address: { diffWindow: (args: any) => Promise<any> }
    common_toponym: { diffWindow: (args: any) => Promise<any> }
    district: { diffWindow: (args: any) => Promise<any> }
  }
}

export type NdjsonType = 'districts' | 'toponyms' | 'addresses'
export type NdjsonEvent = 'created' | 'disabled' | 'updated'

export type NdjsonMetaLine = {
  meta: {
    v: 1
    generatedAt: string
    fromDate: string
    toDate: string
    scope: WindowGeoFilter | { kind: 'france' }
    types: NdjsonType[]
    events: NdjsonEvent[]
    paging: { take: number; skip: number; autoPaginate: boolean }
    counts: Record<NdjsonType, number>
    progress?: {
      type?: NdjsonType
      emitted: number
      totalEmittableEstimate: number
      page?: { skip: number; take: number; pageIndex: number; pageCount: number }
      percent?: number
    }
  }
}

export type NdjsonItemLine =
  | { v: 1; event: 'created' | 'disabled'; type: NdjsonType; id: string; data: any }
  | { v: 1; event: 'updated'; type: NdjsonType; id: string; data: [any, any]; changes?: any[] }

export type ExportNdjsonArgs = {
  from: AtInput
  to: AtInput
  geo?: WindowGeoFilter
  types?: NdjsonType[] // default: all
  take?: number // default: 500 (perf)
  skip?: number // default: 0
  normalize?: boolean
  includeChanges?: boolean // (optional, expensive) compute detailed changes for updated
  ignorePaths?: (string | RegExp)[]
  maxChanges?: number
  autoPaginate?: boolean // default: false
  /**
   * Emit a progress meta line every N emitted item lines.
   * - 0 / undefined => no progress meta lines
   * - recommended: 500 or 2000 depending on consumer
   */
  progressEvery?: number
}

/* ----------------------------- tiny utilities ---------------------------- */

function toDate(at: AtInput): Date {
  return at instanceof Date ? at : new Date(at)
}

function asIso(d: Date | string) {
  const dt = d instanceof Date ? d : new Date(d)
  return dt.toISOString()
}

function ndjson(line: any) {
  return JSON.stringify(line) + '\n'
}

function classifyEvent(before: any, after: any): NdjsonEvent | null {
  if (!before && after) return 'created'
  if (before && !after) return 'disabled' // per your spec: disabled only if after === null
  if (before && after) return 'updated'
  return null // ephemeral/noop => not emitted
}

/* ------------------------ optional normalization (UI) ------------------------ */

type AnyObj = Record<string, any>

function stableOrderObject(input: any, preferredKeys: string[] = []): any {
  if (Array.isArray(input)) return input.map((x) => stableOrderObject(x))
  if (!input || typeof input !== 'object') return input

  const obj = input as AnyObj
  const out: AnyObj = {}

  const preferred = preferredKeys.filter((k) => k in obj)
  for (const k of preferred) out[k] = stableOrderObject(obj[k])

  const restKeys = Object.keys(obj)
    .filter((k) => !preferred.includes(k))
    .sort()

  for (const k of restKeys) out[k] = stableOrderObject(obj[k])

  return out
}

const PREF_ADDRESS = [
  'id',
  'mainCommonToponymID',
  'secondaryCommonToponymIDs',
  'districtID',
  'number',
  'suffix',
  'certified',
  'positions',
  'labels',
  'isActive',
  'validity',
  'updateDate',
  'meta',
  'range_validity',
  'updatedAtPrecise',
]

const PREF_COMMON_TOPONYM = [
  'id',
  'districtID',
  'positions',
  'labels',
  'isActive',
  'validity',
  'updateDate',
  'meta',
  'range_validity',
  'updatedAtPrecise',
]

const PREF_DISTRICT = [
  'id',
  'labels',
  'isActive',
  'validity',
  'updateDate',
  'meta',
  'config',
  'range_validity',
  'updatedAtPrecise',
]

function preferredKeysForType(type: NdjsonType) {
  return type === 'addresses' ? PREF_ADDRESS : type === 'toponyms' ? PREF_COMMON_TOPONYM : PREF_DISTRICT
}

/* ---------------------- batch snapshot (THE perf patch) --------------------- */

type SnapshotRow = {
  id: string
  data: AnyObj
  valid_from: Date
  valid_to: Date | null
}

function baseTableForType(type: NdjsonType) {
  return type === 'districts' ? 'district' : type === 'toponyms' ? 'common_toponym' : 'address'
}

function dataJsonSql(alias = 't') {
  return Prisma.sql`
    (to_jsonb(${Prisma.raw(alias)}) - 'range_validity')
    || jsonb_build_object('range_validity', ${Prisma.raw(alias)}.range_validity::text)
  `
}

async function snapshotMapForIds(
  prisma: PrismaClient,
  type: NdjsonType,
  ids: string[],
  at: AtInput,
  normalize?: boolean
): Promise<Map<string, AnyObj>> {
  const map = new Map<string, AnyObj>()
  if (!ids.length) return map

  const atDate = toDate(at)
  const base = baseTableForType(type)
  const hist = `${base}_h`

  const rows = await prisma.$queryRaw<SnapshotRow[]>(Prisma.sql`
    select distinct on (t.id)
      t.id,
      ${dataJsonSql('t')} as data,
      lower(t.range_validity) as valid_from,
      upper(t.range_validity) as valid_to
    from (
      select * from ban.${Prisma.raw(hist)} where id = any(${ids}::uuid[])
      union all
      select * from ban.${Prisma.raw(base)} where id = any(${ids}::uuid[])
    ) t
    where t.range_validity @> ${atDate}::timestamptz
    order by t.id, lower(t.range_validity) desc
  `)

  const preferred = preferredKeysForType(type)

  for (const r of rows) {
    const obj = {
      ...(r.data ?? {}),
      validity: { validFrom: r.valid_from, validTo: r.valid_to },
      updatedAtPrecise: r.valid_from,
    }

    map.set(r.id, normalize ? (stableOrderObject(obj, preferred) as AnyObj) : (obj as AnyObj))
  }

  return map
}

/* --------------------------- optional detailed diff -------------------------- */

type DiffChange = { path: string; before: any; after: any }

type DiffOptions = {
  ignorePaths?: (string | RegExp)[]
  maxChanges?: number
}

function shouldIgnore(path: string, ignore: DiffOptions['ignorePaths']) {
  if (!ignore?.length) return false
  return ignore.some((p) => (typeof p === 'string' ? p === path : p.test(path)))
}

function diffValues(a: any, b: any, opts: DiffOptions, path = ''): DiffChange[] {
  if (opts.maxChanges && opts.maxChanges <= 0) return []
  if (shouldIgnore(path, opts.ignorePaths)) return []
  if (a === b) return []
  if (a == null || b == null) return [{ path, before: a, after: b }]

  if (Array.isArray(a) && Array.isArray(b)) {
    const changes: DiffChange[] = []
    const len = Math.max(a.length, b.length)
    for (let i = 0; i < len; i++) {
      const childPath = `${path}[${i}]`
      changes.push(...diffValues(a[i], b[i], opts, childPath))
      if (opts.maxChanges && changes.length >= opts.maxChanges) break
    }
    return changes
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const changes: DiffChange[] = []
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const k of Array.from(keys).sort()) {
      const childPath = path ? `${path}.${k}` : k
      changes.push(...diffValues(a[k], b[k], opts, childPath))
      if (opts.maxChanges && changes.length >= opts.maxChanges) break
    }
    return changes
  }

  return [{ path, before: a, after: b }]
}

/* ----------------------------- main exporter ----------------------------- */

type DiffWindowResult = {
  from: string
  to: string
  take: number
  skip: number
  total: number
  ids: string[]
}

export async function* exportNdjson(prisma: PrismaClient, args: ExportNdjsonArgs): AsyncGenerator<string> {
  const prismaWithTimeline = prisma as PrismaClientWithTimeline

  const types: NdjsonType[] = args.types ?? ['districts', 'toponyms', 'addresses']
  const take = args.take ?? 500 // 👈 default bumped for perf
  const baseSkip = args.skip ?? 0
  const autoPaginate = args.autoPaginate ?? false
  const progressEvery = args.progressEvery ?? 0

  const counts: Record<NdjsonType, number> = { districts: 0, toponyms: 0, addresses: 0 }

  // 1) totals per type (cheap). Uses diffWindow(includeDiffs:false) and reads .total
  const windowsNoDiff = {
    districts: (skip: number) =>
      prismaWithTimeline.timeline.district.diffWindow({
        from: args.from,
        to: args.to,
        geo: args.geo,
        take,
        skip,
        normalize: false, // ids only
        includeDiffs: false,
      }) as Promise<DiffWindowResult>,

    toponyms: (skip: number) =>
      prismaWithTimeline.timeline.common_toponym.diffWindow({
        from: args.from,
        to: args.to,
        geo: args.geo,
        take,
        skip,
        normalize: false,
        includeDiffs: false,
      }) as Promise<DiffWindowResult>,

    addresses: (skip: number) =>
      prismaWithTimeline.timeline.address.diffWindow({
        from: args.from,
        to: args.to,
        geo: args.geo,
        take,
        skip,
        normalize: false,
        includeDiffs: false,
      }) as Promise<DiffWindowResult>,
  } as const

  for (const t of types) {
    const r = await windowsNoDiff[t](baseSkip)
    counts[t] = r.total
  }

  // 2) meta header
  const metaBase: NdjsonMetaLine['meta'] = {
    v: 1,
    generatedAt: new Date().toISOString(),
    fromDate: asIso(args.from),
    toDate: asIso(args.to),
    scope: args.geo ?? { kind: 'france' },
    types,
    events: ['created', 'disabled', 'updated'],
    paging: { take, skip: baseSkip, autoPaginate },
    counts,
  }
  yield ndjson({ meta: metaBase })

  // 3) progress accounting
  let emitted = 0
  const totalEstimate = types.reduce((sum, t) => sum + (counts[t] || 0), 0)

  const emitProgressLine = async (
    type?: NdjsonType,
    page?: { skip: number; take: number; pageIndex: number; pageCount: number }
  ) => {
    const percent = totalEstimate > 0 ? Math.min(100, Math.floor((emitted / totalEstimate) * 100)) : undefined
    const meta: NdjsonMetaLine = {
      meta: {
        ...metaBase,
        progress: {
          type,
          emitted,
          totalEmittableEstimate: totalEstimate,
          page,
          percent,
        },
      },
    }
    return ndjson(meta)
  }

  // 4) stream items, page-by-page, using TWO snapshot queries per page (from/to)
  for (const t of types) {
    const total = counts[t]
    const remaining = Math.max(0, total - baseSkip)
    const pageCount = Math.max(1, Math.ceil(remaining / take))

    const emitOnePage = async function* (skip: number, pageIndex: number) {
      const page = await windowsNoDiff[t](skip)
      const ids = page.ids ?? []
      if (!ids.length) return

      // batch snapshots
      const afterMap = await snapshotMapForIds(prisma, t, ids, args.to, args.normalize)
      const beforeMap = await snapshotMapForIds(prisma, t, ids, args.from, args.normalize)

      for (const id of ids) {
        const before = beforeMap.get(id) ?? null
        const after = afterMap.get(id) ?? null
        const event = classifyEvent(before, after)
        if (!event) continue

        if (event === 'updated') {
          const line: NdjsonItemLine = {
            v: 1,
            event,
            type: t,
            id,
            data: [after, before],
          }

          if (args.includeChanges) {
            line.changes = diffValues(before, after, {
              ignorePaths: args.ignorePaths,
              maxChanges: args.maxChanges,
            })
          }

          yield ndjson(line)
        } else {
          const line: NdjsonItemLine = {
            v: 1,
            event,
            type: t,
            id,
            data: event === 'created' ? after : before,
          }
          yield ndjson(line)
        }

        emitted++
        if (progressEvery > 0 && emitted % progressEvery === 0) {
          yield await emitProgressLine(t, { skip, take, pageIndex, pageCount })
        }
      }
    }

    if (!autoPaginate) {
      for await (const line of emitOnePage(baseSkip, 1)) yield line
      continue
    }

    for (let skip = baseSkip, pageIndex = 1; skip < total; skip += take, pageIndex++) {
      for await (const line of emitOnePage(skip, pageIndex)) yield line
    }
  }

  // final progress line
  if (progressEvery > 0) {
    yield await emitProgressLine(undefined, undefined)
  }
}
