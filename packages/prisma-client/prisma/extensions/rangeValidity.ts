import { Prisma, PrismaClient } from '../../generated/client/client.js'

type Order = 'asc' | 'desc'
export type AtInput = Date | string

export type FindManyWithValidityArgs = {
  where?: Record<string, unknown>
  at?: AtInput
  orderByValidFrom?: Order
  take?: number
  skip?: number
  normalize?: boolean
}

export type BanHistoryTable = 'address_h' | 'common_toponym_h' | 'district_h'
export type BanWorkingTable = 'address' | 'common_toponym' | 'district'
export type BanTable = BanHistoryTable | BanWorkingTable

export type Validity = { validFrom: Date; validTo: Date | null }
export type WithValidity<T extends Record<string, any>> = T & {
  range_validity?: string
  validity: Validity
  updatedAtPrecise: Date
}

/**
 * WARNING :
 * ALLOWED_COLS_BY_TABLE is a security measure to prevent SQL injection via the 'where' argument.
 * Do not add any column without ensuring it is safe in this context.
 */
const ALLOWED_COLS_BY_TABLE: Record<BanTable, Set<string>> = {
  address: new Set(['id', 'districtID', 'mainCommonToponymID', 'isActive', 'certified', 'number', 'suffix']),
  address_h: new Set(['id', 'districtID', 'mainCommonToponymID', 'isActive', 'certified', 'number', 'suffix']),
  common_toponym: new Set(['id', 'districtID', 'isActive']),
  common_toponym_h: new Set(['id', 'districtID', 'isActive']),
  district: new Set(['id', 'isActive']),
  district_h: new Set(['id', 'isActive']),
}

function toDate(at: AtInput): Date {
  return at instanceof Date ? at : new Date(at)
}

/* ----------------------------- Normalization ----------------------------- */

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

function kindFromTable(table: BanTable): 'address' | 'common_toponym' | 'district' {
  if (table.startsWith('address')) return 'address'
  if (table.startsWith('common_toponym')) return 'common_toponym'
  return 'district'
}

function normalizeRowIfNeeded<T extends AnyObj>(table: BanTable, row: WithValidity<T>, normalize?: boolean): WithValidity<T> {
  if (!normalize) return row

  const kind = kindFromTable(table)
  const preferred =
    kind === 'address' ? PREF_ADDRESS :
    kind === 'common_toponym' ? PREF_COMMON_TOPONYM :
    PREF_DISTRICT

  // important: we normalize the entire returned object (data + validity fields)
  return stableOrderObject(row, preferred) as WithValidity<T>
}

/* ------------------------------ SQL helpers ------------------------------ */

function buildWhereFromObject(where: Record<string, unknown>, table: BanTable, alias = 't') {
  const allowed = ALLOWED_COLS_BY_TABLE[table]
  const conds: Prisma.Sql[] = [Prisma.sql`true`]

  for (const [k, v] of Object.entries(where ?? {})) {
    if (v === undefined) continue
    if (!allowed.has(k)) continue

    if (typeof v === 'string' && (k === 'id' || k.endsWith('ID'))) {
      conds.push(Prisma.sql`${Prisma.raw(alias)}.${Prisma.raw(`"${k}"`)} = ${v}::uuid`)
      continue
    }

    if (typeof v === 'boolean') {
      conds.push(Prisma.sql`${Prisma.raw(alias)}.${Prisma.raw(`"${k}"`)} = ${v}`)
      continue
    }

    if (typeof v === 'string' || typeof v === 'number') {
      conds.push(Prisma.sql`${Prisma.raw(alias)}.${Prisma.raw(`"${k}"`)} = ${v}`)
    }
  }

  return Prisma.join(conds, ' and ')
}

type RowWithValidityJson = {
  data: Record<string, any>
  valid_from: Date
  valid_to: Date | null
}

/**
 * Builds JSON "data" safely:
 * - removes range_validity (tstzrange)
 * - re-injects it as TEXT (supported by Prisma)
 */
function dataJsonSql(alias = 't') {
  return Prisma.sql`
    (to_jsonb(${Prisma.raw(alias)}) - 'range_validity')
    || jsonb_build_object('range_validity', ${Prisma.raw(alias)}.range_validity::text)
  `
}

/* ------------------------------ Geo helpers ------------------------------ */

function cogExpr(alias = 'd') {
  // district.meta.insee.cog
  return Prisma.sql`${Prisma.raw(alias)}.meta->'insee'->>'cog'`
}

function depFromCogSql(cog: Prisma.Sql) {
  // Corse + DOM/COM, fallback 2 digits
  return Prisma.sql`
    case
      when ${cog} like '2A%' then '2A'
      when ${cog} like '2B%' then '2B'
      when ${cog} like '97%' or ${cog} like '98%' then left(${cog}, 3)
      else left(${cog}, 2)
    end
  `
}

function districtGeoWhereSql(geo?: WindowGeoFilter, dAlias = 'd'): Prisma.Sql {
  if (!geo || geo.kind === 'france') return Prisma.sql`true`

  const cog = cogExpr(dAlias)

  if (geo.kind === 'commune') {
    return Prisma.sql`${cog} = ${geo.cog}`
  }

  if (geo.kind === 'departement') {
    const depExpr = depFromCogSql(cog)
    return Prisma.sql`${depExpr} = ${geo.dep}`
  }

  return Prisma.sql`true`
}

/* --------------------------- Core read functions -------------------------- */

async function findManyWithValidityTable<T extends AnyObj>(
  prisma: PrismaClient,
  table: BanTable,
  args: FindManyWithValidityArgs = {}
): Promise<Array<WithValidity<T>>> {
  const atDate = args.at ? toDate(args.at) : null
  const whereSql = buildWhereFromObject(args.where ?? {}, table, 't')
  const order = args.orderByValidFrom ?? 'desc'
  const take = args.take ?? 100
  const skip = args.skip ?? 0

  const atCond = atDate
    ? Prisma.sql` and t.range_validity @> ${atDate}::timestamptz`
    : Prisma.sql``

  const rows = await prisma.$queryRaw<RowWithValidityJson[]>(Prisma.sql`
    select
      ${dataJsonSql('t')} as data,
      lower(t.range_validity) as valid_from,
      upper(t.range_validity) as valid_to
    from ban.${Prisma.raw(table)} t
    where ${whereSql} ${atCond}
    order by lower(t.range_validity) ${Prisma.raw(order)}
    limit ${take}
    offset ${skip}
  `)

  return rows.map(({ data, valid_from, valid_to }) => {
    const base = {
      ...(data as T),
      validity: { validFrom: valid_from, validTo: valid_to },
      updatedAtPrecise: valid_from,
    } satisfies WithValidity<T>

    return normalizeRowIfNeeded(table, base, args.normalize)
  })
}

async function findUniqueWithValidityTable<T extends AnyObj>(
  prisma: PrismaClient,
  table: BanTable,
  id: string,
  opts?: { normalize?: boolean }
): Promise<WithValidity<T> | null> {
  const rows = await findManyWithValidityTable<T>(prisma, table, {
    where: { id },
    orderByValidFrom: 'desc',
    take: 1,
    normalize: opts?.normalize,
  })
  return rows[0] ?? null
}

async function atMany<T extends AnyObj>(
  prisma: PrismaClient,
  table: BanTable,
  ids: string[],
  at: AtInput,
  opts?: { normalize?: boolean }
): Promise<Array<WithValidity<T>>> {
  if (!ids.length) return []

  const atDate = toDate(at)

  const rows = await prisma.$queryRaw<RowWithValidityJson[]>(Prisma.sql`
    select distinct on (t.id)
      ${dataJsonSql('t')} as data,
      lower(t.range_validity) as valid_from,
      upper(t.range_validity) as valid_to
    from ban.${Prisma.raw(table)} t
    where t.id = any(${ids}::uuid[])
      and t.range_validity @> ${atDate}::timestamptz
    order by t.id, lower(t.range_validity) desc
  `)

  return rows.map(({ data, valid_from, valid_to }) => {
    const base = {
      ...(data as T),
      validity: { validFrom: valid_from, validTo: valid_to },
      updatedAtPrecise: valid_from,
    } satisfies WithValidity<T>

    return normalizeRowIfNeeded(table, base, opts?.normalize)
  })

  // Fallback if "any(${ids}::uuid[])" is not supported in your setup:
  // const uuidList = Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`), ',')
  // const rows = await prisma.$queryRaw<RowWithValidityJson[]>(Prisma.sql`
  //   select distinct on (t.id)
  //     ${dataJsonSql('t')} as data,
  //     lower(t.range_validity) as valid_from,
  //     upper(t.range_validity) as valid_to
  //   from ban.${Prisma.raw(table)} t
  //   where t.id in (${uuidList})
  //     and t.range_validity @> ${atDate}::timestamptz
  //   order by t.id, lower(t.range_validity) desc
  // `)
  // return rows.map(({ data, valid_from, valid_to }) => {
  //   const base = {
  //     ...(data as T),
  //     validity: { validFrom: valid_from, validTo: valid_to },
  //     updatedAtPrecise: valid_from,
  //   } satisfies WithValidity<T>
  //   return normalizeRowIfNeeded(table, base, opts?.normalize)
  // })
}

async function atOne<T extends AnyObj>(
  prisma: PrismaClient,
  table: BanTable,
  id: string,
  at: AtInput,
  opts?: { normalize?: boolean }
): Promise<WithValidity<T> | null> {
  const rows = await atMany<T>(prisma, table, [id], at, opts)
  return rows[0] ?? null
}

/* --------------------------- Core diff functions -------------------------- */

export type DiffChange = {
  path: string
  before: any
  after: any
}

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

  // strict equal (incl. same ref)
  if (a === b) return []

  // handle null/undefined
  if (a == null || b == null) {
    return [{ path, before: a, after: b }]
  }

  // arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    const changes: DiffChange[] = []
    const len = Math.max(a.length, b.length)
    for (let i = 0; i < len; i++) {
      const childPath = `${path}[${i}]`
      const sub = diffValues(a[i], b[i], opts, childPath)
      changes.push(...sub)
      if (opts.maxChanges && changes.length >= opts.maxChanges) break
    }
    return changes
  }

  // objects
  if (typeof a === 'object' && typeof b === 'object') {
    const changes: DiffChange[] = []
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    for (const k of Array.from(keys).sort()) {
      const childPath = path ? `${path}.${k}` : k
      const sub = diffValues((a as any)[k], (b as any)[k], opts, childPath)
      changes.push(...sub)
      if (opts.maxChanges && changes.length >= opts.maxChanges) break
    }
    return changes
  }

  // primitives / different types
  return [{ path, before: a, after: b }]
}

export type DiffResult<T> = {
  id: string
  from: string
  to: string
  changed: boolean
  changes: DiffChange[]
  before?: T | null
  after?: T | null
}

export type DiffCallOptions = {
  normalize?: boolean
  includeSnapshots?: boolean
  ignorePaths?: (string | RegExp)[]
  maxChanges?: number
}

export type WindowGeoFilter =
  | { kind: 'france' }
  | { kind: 'commune'; cog: string }
  | { kind: 'departement'; dep: string } // ex: '64', '971', '2A'

export type DiffWindowArgs = {
  from: AtInput
  to: AtInput
  geo?: WindowGeoFilter
  take?: number
  skip?: number
  normalize?: boolean
  includeDiffs?: boolean
  diff?: Omit<DiffCallOptions, 'normalize'>
}

export type DiffWindowResult<T> = {
  from: string
  to: string
  take: number
  skip: number
  total: number
  ids: string[]
  diffs?: Array<DiffResult<T>>
}


/* ----------------------------- NDJSON export ----------------------------- */

export type DiffEvent = 'created' | 'disabled' | 'updated'
export type DiffEntityType = 'districts' | 'toponyms' | 'addresses'

export type DiffNdjsonArgs = {
  from: AtInput
  to: AtInput
  geo?: WindowGeoFilter
  /**
   * Pagination is applied PER TYPE (districts, toponyms, addresses).
   * (Simple v1, good enough for streaming + demo.)
   */
  take?: number
  skip?: number
  /**
   * Which types to include in the stream (default: all).
   */
  types?: DiffEntityType[]
  /**
   * If true, normalizes snapshots (stable key order BAN).
   */
  normalize?: boolean
  /**
   * If true, includes `changes` on updated events (detailed diff).
   */
  includeChanges?: boolean
  /**
   * Diff options (only used if includeChanges=true).
   */
  ignorePaths?: (string | RegExp)[]
  maxChanges?: number

  progressEvery?: number
}

export type NdjsonMetaV1 = {
  v: 1
  generatedAt: string
  fromDate: string
  toDate: string
  scope: WindowGeoFilter
  types: DiffEntityType[]
  events: DiffEvent[]
  paging: { take: number; skip: number }
  counts: Partial<Record<DiffEntityType, number>>
}

export type NdjsonLineV1 =
  | { meta: NdjsonMetaV1 }
  | { v: 1; event: DiffEvent; type: DiffEntityType; id: string; data: any; changes?: DiffChange[] }

function baseFromEntityType(t: DiffEntityType): 'district' | 'common_toponym' | 'address' {
  if (t === 'districts') return 'district'
  if (t === 'toponyms') return 'common_toponym'
  return 'address'
}

function classifyEvent(before: any, after: any): DiffEvent | 'noop' {
  if (!before && after) return 'created'
  if (before && !after) return 'disabled'
  if (before && after) return 'updated'
  return 'noop' // (created+disabled within window → both null at endpoints)
}

function ndjsonStringify(obj: any): string {
  return `${JSON.stringify(obj)}
`
}

function iso(d: Date | string) {
  const dt = d instanceof Date ? d : new Date(d)
  return dt.toISOString()
}

async function diffOne<T extends Record<string, any>>(
  getAt: (id: string, at: AtInput, opts?: { normalize?: boolean }) => Promise<T | null>,
  id: string,
  from: AtInput,
  to: AtInput,
  opts: DiffCallOptions = {}
): Promise<DiffResult<T>> {
  const before = await getAt(id, from, { normalize: opts.normalize })
  const after = await getAt(id, to, { normalize: opts.normalize })

  const changes = diffValues(before, after, {
    ignorePaths: opts.ignorePaths,
    maxChanges: opts.maxChanges,
  })

  const res: DiffResult<T> = {
    id,
    from: iso(from),
    to: iso(to),
    changed: changes.length > 0,
    changes,
  }

  if (opts.includeSnapshots) {
    res.before = before
    res.after = after
  }

  return res
}

/* ---------------------------- Prisma $extends ----------------------------- */

/* -------------------------- Timeline (history + current) -------------------------- */

type BanBaseTable = 'address' | 'common_toponym' | 'district'

function historyTableOf(base: BanBaseTable): BanHistoryTable {
  return `${base}_h` as BanHistoryTable
}

async function timelineAtMany<T extends AnyObj>(
  prisma: PrismaClient,
  baseTable: BanBaseTable,
  ids: string[],
  at: AtInput,
  opts?: { normalize?: boolean }
): Promise<Array<WithValidity<T>>> {
  if (!ids.length) return []

  const atDate = toDate(at)
  const hTable = historyTableOf(baseTable)
  const cTable = baseTable as BanWorkingTable

  const rows = await prisma.$queryRaw<RowWithValidityJson[]>(Prisma.sql`
    select distinct on (t.id)
      ${dataJsonSql('t')} as data,
      lower(t.range_validity) as valid_from,
      upper(t.range_validity) as valid_to
    from (
      select * from ban.${Prisma.raw(hTable)} where id = any(${ids}::uuid[])
      union all
      select * from ban.${Prisma.raw(cTable)} where id = any(${ids}::uuid[])
    ) t
    where t.range_validity @> ${atDate}::timestamptz
    order by t.id, lower(t.range_validity) desc
  `)

  // Use the base table name for kind detection / normalization presets
  const kindTable = cTable as BanTable

  return rows.map(({ data, valid_from, valid_to }) => {
    const base = {
      ...(data as T),
      validity: { validFrom: valid_from, validTo: valid_to },
      updatedAtPrecise: valid_from,
    } satisfies WithValidity<T>

    return normalizeRowIfNeeded(kindTable, base, opts?.normalize)
  })
}

async function timelineAtOne<T extends AnyObj>(
  prisma: PrismaClient,
  baseTable: BanBaseTable,
  id: string,
  at: AtInput,
  opts?: { normalize?: boolean }
): Promise<WithValidity<T> | null> {
  const rows = await timelineAtMany<T>(prisma, baseTable, [id], at, opts)
  return rows[0] ?? null
}

/* ----------------------------- Window (mass diff) ----------------------------- */

function windowRangeSql(from: AtInput, to: AtInput) {
  const f = toDate(from)
  const t = toDate(to)
  // fenêtre [from,to)
  return Prisma.sql`tstzrange(${f}::timestamptz, ${t}::timestamptz, '[)')`
}

async function windowChangedIdsForDistrict(
  prisma: PrismaClient,
  from: AtInput,
  to: AtInput,
  geo?: WindowGeoFilter,
  take = 200,
  skip = 0
): Promise<{ total: number; ids: string[] }> {
  const w = windowRangeSql(from, to)
  const geoWhere = districtGeoWhereSql(geo, 'd')

  const totalRows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
    select count(*)::bigint as total
    from (
      select distinct t.id
      from (
        select id, range_validity from ban.district_h
        union all
        select id, range_validity from ban.district
      ) t
      join ban.district d on d.id = t.id
      where t.range_validity && ${w}
        and ${geoWhere}
    ) x
  `)

  const total = Number(totalRows[0]?.total ?? 0n)

  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    select distinct t.id
    from (
      select id, range_validity from ban.district_h
      union all
      select id, range_validity from ban.district
    ) t
    join ban.district d on d.id = t.id
    where t.range_validity && ${w}
      and ${geoWhere}
    order by t.id
    limit ${take}
    offset ${skip}
  `)

  return { total, ids: rows.map((r) => r.id) }
}

async function windowChangedIdsForChildTable(
  prisma: PrismaClient,
  baseTable: 'address' | 'common_toponym',
  from: AtInput,
  to: AtInput,
  geo?: WindowGeoFilter,
  take = 200,
  skip = 0
): Promise<{ total: number; ids: string[] }> {
  const hTable = `${baseTable}_h` as const
  const w = windowRangeSql(from, to)
  const geoWhere = districtGeoWhereSql(geo, 'd')

  const totalRows = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
    select count(*)::bigint as total
    from (
      select distinct t.id
      from (
        select id, "districtID", range_validity from ban.${Prisma.raw(hTable)}
        union all
        select id, "districtID", range_validity from ban.${Prisma.raw(baseTable)}
      ) t
      join ban.district d on d.id = t."districtID"
      where t.range_validity && ${w}
        and ${geoWhere}
    ) x
  `)

  const total = Number(totalRows[0]?.total ?? 0n)

  const rows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    select distinct t.id
    from (
      select id, "districtID", range_validity from ban.${Prisma.raw(hTable)}
      union all
      select id, "districtID", range_validity from ban.${Prisma.raw(baseTable)}
    ) t
    join ban.district d on d.id = t."districtID"
    where t.range_validity && ${w}
      and ${geoWhere}
    order by t.id
    limit ${take}
    offset ${skip}
  `)

  return { total, ids: rows.map((r) => r.id) }
}


async function getWindowTotalsForTypes(
  prisma: PrismaClient,
  from: AtInput,
  to: AtInput,
  geo: WindowGeoFilter | undefined,
  take: number,
  skip: number,
  types: DiffEntityType[]
): Promise<Partial<Record<DiffEntityType, number>>> {
  const out: Partial<Record<DiffEntityType, number>> = {}

  // totals are "IDs touched in window", not event-specific (cheap + stable)
  for (const t of types) {
    if (t === 'districts') {
      const { total } = await windowChangedIdsForDistrict(prisma, from, to, geo, take, skip)
      out[t] = total
    } else if (t === 'toponyms') {
      const { total } = await windowChangedIdsForChildTable(prisma, 'common_toponym', from, to, geo, take, skip)
      out[t] = total
    } else if (t === 'addresses') {
      const { total } = await windowChangedIdsForChildTable(prisma, 'address', from, to, geo, take, skip)
      out[t] = total
    }
  }

  return out
}

async function* diffNdjsonV1(
  prisma: PrismaClient,
  args: DiffNdjsonArgs
): AsyncGenerator<string, void, void> {
  const take = args.take ?? 200
  const skip = args.skip ?? 0
  const types: DiffEntityType[] = args.types ?? ['districts', 'toponyms', 'addresses']
  const scope: WindowGeoFilter = args.geo ?? { kind: 'france' }

  const counts = await getWindowTotalsForTypes(prisma, args.from, args.to, scope, take, skip, types)

  const meta: NdjsonMetaV1 = {
    v: 1,
    generatedAt: new Date().toISOString(),
    fromDate: iso(args.from),
    toDate: iso(args.to),
    scope,
    types,
    events: ['created', 'disabled', 'updated'],
    paging: { take, skip },
    counts,
  }

  yield ndjsonStringify({ meta })

  const diffOpts: DiffOptions = { ignorePaths: args.ignorePaths, maxChanges: args.maxChanges }

  for (const type of types) {
    const base = baseFromEntityType(type)

    // ids page (per type)
    const ids =
      type === 'districts'
        ? (await windowChangedIdsForDistrict(prisma, args.from, args.to, scope, take, skip)).ids
        : type === 'toponyms'
          ? (await windowChangedIdsForChildTable(prisma, 'common_toponym', args.from, args.to, scope, take, skip)).ids
          : (await windowChangedIdsForChildTable(prisma, 'address', args.from, args.to, scope, take, skip)).ids

    for (const id of ids) {
      const before = await timelineAtOne(prisma, base, id, args.from, { normalize: args.normalize })
      const after = await timelineAtOne(prisma, base, id, args.to, { normalize: args.normalize })

      const event = classifyEvent(before, after)
      if (event === 'noop') continue

      if (event === 'updated') {
        const line: any = {
          v: 1 as const,
          event,
          type,
          id,
          // order: most recent → oldest
          data: [after, before],
        }

        if (args.includeChanges) {
          line.changes = diffValues(before, after, diffOpts)
        }

        yield ndjsonStringify(line)
        continue
      }

      // created / disabled
      const snapshot = event === 'created' ? after : before
      yield ndjsonStringify({
        v: 1 as const,
        event,
        type,
        id,
        data: snapshot,
      })
    }
  }
}

async function diffWindowForBase<T extends AnyObj>(
  prisma: PrismaClient,
  base: 'address' | 'common_toponym' | 'district',
  args: DiffWindowArgs
): Promise<DiffWindowResult<WithValidity<T>>> {
  const take = args.take ?? 200
  const skip = args.skip ?? 0
  const includeDiffs = args.includeDiffs ?? true

  const { total, ids } =
    base === 'district'
      ? await windowChangedIdsForDistrict(prisma, args.from, args.to, args.geo, take, skip)
      : await windowChangedIdsForChildTable(prisma, base, args.from, args.to, args.geo, take, skip)

  const res: DiffWindowResult<WithValidity<T>> = {
    from: iso(args.from),
    to: iso(args.to),
    take,
    skip,
    total,
    ids,
  }

  if (!includeDiffs) return res

  const diffOpts: DiffCallOptions = {
    normalize: args.normalize,
    includeSnapshots: args.diff?.includeSnapshots,
    ignorePaths: args.diff?.ignorePaths,
    maxChanges: args.diff?.maxChanges,
  }

  res.diffs = await Promise.all(
    ids.map((id) =>
      diffOne<WithValidity<T>>(
        (id2, at2, o) => timelineAtOne<T>(prisma, base, id2, at2, o),
        id,
        args.from,
        args.to,
        diffOpts
      )
    )
  )

  return res
}

export function withRangeValidity(prisma: PrismaClient) {
  return prisma.$extends({
    name: 'ban-range-validity',

    model: {
      address: {
        findUniqueWithValidity: (id: string, opts?: { normalize?: boolean }) =>
          findUniqueWithValidityTable(prisma, 'address', id, opts),

        findManyWithValidity: (args?: FindManyWithValidityArgs) =>
          findManyWithValidityTable(prisma, 'address', args),

        at: (id: string, at: AtInput, opts?: { normalize?: boolean }) =>
          atOne(prisma, 'address', id, at, opts),

        atMany: (ids: string[], at: AtInput, opts?: { normalize?: boolean }) =>
          atMany(prisma, 'address', ids, at, opts),
      },

      common_toponym: {
        findUniqueWithValidity: (id: string, opts?: { normalize?: boolean }) =>
          findUniqueWithValidityTable(prisma, 'common_toponym', id, opts),

        findManyWithValidity: (args?: FindManyWithValidityArgs) =>
          findManyWithValidityTable(prisma, 'common_toponym', args),

        at: (id: string, at: AtInput, opts?: { normalize?: boolean }) =>
          atOne(prisma, 'common_toponym', id, at, opts),

        atMany: (ids: string[], at: AtInput, opts?: { normalize?: boolean }) =>
          atMany(prisma, 'common_toponym', ids, at, opts),
      },

      district: {
        findUniqueWithValidity: (id: string, opts?: { normalize?: boolean }) =>
          findUniqueWithValidityTable(prisma, 'district', id, opts),

        findManyWithValidity: (args?: FindManyWithValidityArgs) =>
          findManyWithValidityTable(prisma, 'district', args),

        at: (id: string, at: AtInput, opts?: { normalize?: boolean }) =>
          atOne(prisma, 'district', id, at, opts),

        atMany: (ids: string[], at: AtInput, opts?: { normalize?: boolean }) =>
          atMany(prisma, 'district', ids, at, opts),
      },
    },

    client: {
      history: {
        address: {
          findUniqueWithValidity: (id: string, opts?: { normalize?: boolean }) =>
            findUniqueWithValidityTable(prisma, 'address_h', id, opts),

          findManyWithValidity: (args?: FindManyWithValidityArgs) =>
            findManyWithValidityTable(prisma, 'address_h', args),

          at: (id: string, at: AtInput, opts?: { normalize?: boolean }) =>
            atOne(prisma, 'address_h', id, at, opts),

          atMany: (ids: string[], at: AtInput, opts?: { normalize?: boolean }) =>
            atMany(prisma, 'address_h', ids, at, opts),
        },

        common_toponym: {
          findUniqueWithValidity: (id: string, opts?: { normalize?: boolean }) =>
            findUniqueWithValidityTable(prisma, 'common_toponym_h', id, opts),

          findManyWithValidity: (args?: FindManyWithValidityArgs) =>
            findManyWithValidityTable(prisma, 'common_toponym_h', args),

          at: (id: string, at: AtInput, opts?: { normalize?: boolean }) =>
            atOne(prisma, 'common_toponym_h', id, at, opts),

          atMany: (ids: string[], at: AtInput, opts?: { normalize?: boolean }) =>
            atMany(prisma, 'common_toponym_h', ids, at, opts),
        },

        district: {
          findUniqueWithValidity: (id: string, opts?: { normalize?: boolean }) =>
            findUniqueWithValidityTable(prisma, 'district_h', id, opts),

          findManyWithValidity: (args?: FindManyWithValidityArgs) =>
            findManyWithValidityTable(prisma, 'district_h', args),

          at: (id: string, at: AtInput, opts?: { normalize?: boolean }) =>
            atOne(prisma, 'district_h', id, at, opts),

          atMany: (ids: string[], at: AtInput, opts?: { normalize?: boolean }) =>
            atMany(prisma, 'district_h', ids, at, opts),

        },
      },

      timeline: {
        exportNdjson: (args: DiffNdjsonArgs) => diffNdjsonV1(prisma, args),

        address: {
          at: (id: string, at: AtInput, opts?: { normalize?: boolean }) =>
            timelineAtOne(prisma, 'address', id, at, opts),

          atMany: (ids: string[], at: AtInput, opts?: { normalize?: boolean }) =>
            timelineAtMany(prisma, 'address', ids, at, opts),

          diff: (id: string, from: AtInput, to: AtInput, opts?: DiffCallOptions) =>
            diffOne((id2, at2, o) => timelineAtOne(prisma, 'address', id2, at2, o), id, from, to, opts),

          diffWindow: (args: DiffWindowArgs) => diffWindowForBase(prisma, 'address', args),
        },

        common_toponym: {
          at: (id: string, at: AtInput, opts?: { normalize?: boolean }) =>
            timelineAtOne(prisma, 'common_toponym', id, at, opts),

          atMany: (ids: string[], at: AtInput, opts?: { normalize?: boolean }) =>
            timelineAtMany(prisma, 'common_toponym', ids, at, opts),

          diff: (id: string, from: AtInput, to: AtInput, opts?: DiffCallOptions) =>
            diffOne((id2, at2, o) => timelineAtOne(prisma, 'common_toponym', id2, at2, o), id, from, to, opts),

          diffWindow: (args: DiffWindowArgs) => diffWindowForBase(prisma, 'common_toponym', args),
        },

        district: {
          at: (id: string, at: AtInput, opts?: { normalize?: boolean }) =>
            timelineAtOne(prisma, 'district', id, at, opts),

          atMany: (ids: string[], at: AtInput, opts?: { normalize?: boolean }) =>
            timelineAtMany(prisma, 'district', ids, at, opts),

          diff: (id: string, from: AtInput, to: AtInput, opts?: DiffCallOptions) =>
            diffOne((id2, at2, o) => timelineAtOne(prisma, 'district', id2, at2, o), id, from, to, opts),

          diffWindow: (args: DiffWindowArgs) => diffWindowForBase(prisma, 'district', args),
        },
      },
    },
  })
}
