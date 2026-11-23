import { createHash } from 'node:crypto'

import { normalize } from '@nivalis/normadresse'

export class InvalidTargetKeyInput extends Error {
  constructor() {
    super('Invalid or inconsistent target-key input')
    this.name = 'InvalidTargetKeyInput'
  }
}

export interface Road {
  key: string
  cog: string
  label: string
  toponymID?: string
}

export interface PreparedMessage {
  id: string
  inputHash: string
  original: Record<string, unknown>
  rows: Record<string, unknown>[]
  roads: Road[]
  rowKeys: string[]
  numbers: number[]
}

export interface EnrichedRow extends Record<string, unknown> {
  ban_enrich_deprecated_cle_interop?: string
  ban_enrich_retained_cle_interop: string
  ban_enrich_ban_target_keys_address: string[]
  ban_enrich_ban_target_keys_toponym: string[]
  ban_enrich_ban_target_keys_district: string[]
}

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v)
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const cog = /^([0-9]{5}|2[ABab][0-9]{3})$/
const afnor = (v: string) => normalize(v).replace(/\s+/g, '-')

/** NFC, whitespace and case only: accents and punctuation remain significant. */
export const normalizeRoadLabel = (label: string): string =>
  label.normalize('NFC').trim().replace(/\s+/gu, ' ').toLowerCase()

const hashInput = (value: unknown): string => {
  const hash = createHash('sha256')
  const ancestors = new Set<object>()
  let bytes = 0
  const emit = (part: string) => {
    bytes += Buffer.byteLength(part)
    if (bytes > 20_000_000) throw new InvalidTargetKeyInput()
    hash.update(part)
  }
  const visit = (v: unknown, depth = 0) => {
    if (depth > 12) throw new InvalidTargetKeyInput()
    if (typeof v === 'string') {
      if (Buffer.byteLength(v) > 1_000_000) throw new InvalidTargetKeyInput()
      emit(JSON.stringify(v))
    } else if (v === null || v === undefined) emit('null')
    else if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) {
      emit(JSON.stringify(v))
    } else if (Array.isArray(v) || record(v)) {
      if (ancestors.has(v)) throw new InvalidTargetKeyInput()
      ancestors.add(v)
      if (Array.isArray(v)) {
        emit('[')
        v.forEach((item, i) => {
          if (i) emit(',')
          visit(item, depth + 1)
        })
        emit(']')
      } else {
        emit('{')
        Object.keys(v).filter(k => v[k] !== undefined).sort().forEach((key, i) => {
          if (i) emit(',')
          visit(key, depth + 1)
          emit(':')
          visit(v[key], depth + 1)
        })
        emit('}')
      }
      ancestors.delete(v)
    } else throw new InvalidTargetKeyInput()
  }
  visit(value)
  return hash.digest('hex')
}

/** Syntactic BAL validation; no national COG/reference lookup. */
export const eligibleProvidedKey = (value: unknown, number: number): value is string => {
  if (typeof value !== 'string' || value.length > 512 || value !== value.toLowerCase()
    || /\s|[\u0000-\u001f\u007f]/u.test(value)) return false
  const parts = value.split('_')
  if (parts.length < 3 || parts.some(part => part === '') || parts[0].length !== 5
    || !cog.test(parts[0])
    || !/^\d{5}$/.test(parts[2]) || Number(parts[2]) !== number) return false
  if (parts.slice(3).some(part => !/^[\p{Ll}\p{M}\p{N}]+$/u.test(part)
    || part === 'quater' || part === 'quinquies')) return false
  const roadCode = parts[1]
  if (roadCode.startsWith('x') || roadCode === '0000' || roadCode === 'xxxx') return false
  return /^[a-z0-9]{4}$/.test(roadCode) || /^[a-z0-9]{6}$/.test(roadCode)
    || (roadCode.length === 36 && uuid.test(roadCode))
}

export const prepareMessage = (content: unknown): PreparedMessage => {
  let input = content
  if (typeof input === 'string') {
    if (Buffer.byteLength(input) > 20_000_000) throw new InvalidTargetKeyInput()
    try {
      input = JSON.parse(input)
    } catch {
      throw new InvalidTargetKeyInput()
    }
  }
  if (!record(input) || typeof input.id !== 'string' || /\s/u.test(input.id)
    || !/^[\w.-]{1,128}$/.test(input.id)
    || !Array.isArray(input.rows) || input.rows.length === 0 || input.rows.length > 100_000) {
    throw new InvalidTargetKeyInput()
  }
  const inputHash = hashInput(input)
  const roads = new Map<string, Road>()
  const rowKeys: string[] = []
  const numbers: number[] = []
  const indices = new Set<number>()
  const labelsByUUID = new Map<string, string>()
  for (const row of input.rows) {
    if (!record(row) || typeof row.commune_insee !== 'string' || row.commune_insee.length !== 5
      || !cog.test(row.commune_insee)
      || typeof row.voie_nom !== 'string' || row.voie_nom.length > 512
      || !normalizeRoadLabel(row.voie_nom) || /[\u0000-\u001f\u007f]/u.test(row.voie_nom)
      || !Number.isSafeInteger(row.__balRowIndex) || Number(row.__balRowIndex) < 0
      || indices.has(Number(row.__balRowIndex))) throw new InvalidTargetKeyInput()
    indices.add(Number(row.__balRowIndex))
    for (const key of ['id_ban_commune', 'id_ban_toponyme', 'id_ban_adresse']) {
      const value = row[key]
      if (value !== undefined && value !== '' && (typeof value !== 'string'
        || value.length !== 36 || !uuid.test(value))) {
        throw new InvalidTargetKeyInput()
      }
    }
    if ((typeof row.numero !== 'number' && typeof row.numero !== 'string')
      || /\s/u.test(String(row.numero)) || !/^\d+$/.test(String(row.numero))
      || !Number.isSafeInteger(Number(row.numero))
      || Number(row.numero) > 2_147_483_647
      || (row.suffixe !== undefined && (typeof row.suffixe !== 'string' || row.suffixe.length > 255
        || /[\u0000-\u001f\u007f]/u.test(row.suffixe)))
      || (row.cle_interop !== undefined
        && (typeof row.cle_interop !== 'string' || row.cle_interop.length > 512))) {
      throw new InvalidTargetKeyInput()
    }
    const scope = row.commune_insee.toUpperCase()
    const label = normalizeRoadLabel(row.voie_nom)
    const toponymID = typeof row.id_ban_toponyme === 'string' && row.id_ban_toponyme
      ? row.id_ban_toponyme.toLowerCase() : undefined
    const key = JSON.stringify([scope, toponymID ?? null, label])
    const needsCode = !eligibleProvidedKey(row.cle_interop, Number(row.numero))
    if (toponymID && needsCode) {
      const bindingKey = JSON.stringify([scope, toponymID])
      if (labelsByUUID.has(bindingKey) && labelsByUUID.get(bindingKey) !== label) {
        throw new InvalidTargetKeyInput()
      }
      labelsByUUID.set(bindingKey, label)
    }
    if (needsCode) {
      roads.set(key, { key, cog: scope, label, ...(toponymID ? { toponymID } : {}) })
    }
    rowKeys.push(key)
    numbers.push(Number(row.numero))
  }
  return {
    id: input.id, inputHash,
    original: input, rows: input.rows as Record<string, unknown>[],
    roads: [...roads.values()], rowKeys, numbers,
  }
}

export const enrichMessage = (input: PreparedMessage, codes: Record<string, string>) => {
  const selectedByAddress = new Map<string, string>()
  const rows = input.rows.map((row, index): EnrichedRow => {
    const code = codes[input.rowKeys[index]]
    const provided = eligibleProvidedKey(row.cle_interop, input.numbers[index])
    if (!provided && (typeof code !== 'string' || !/^[a-zA-Z0-9]{1,32}$/.test(code))) {
      throw new InvalidTargetKeyInput()
    }
    const suffix = row.suffixe ? `.${afnor(String(row.suffixe))}` : ''
    const district = row.commune_insee || 'DISTRICT'
    const toponym = afnor(String(row.voie_nom || '')) || 'TOPONYM'
    const address = !row.numero && row.lieudit_complement_nom
      ? afnor(String(row.lieudit_complement_nom)) : `${row.numero || 'ADDRESS'}${suffix}`
    const number = String(input.numbers[index]).padStart(5, '0')
    const interopSuffix = row.suffixe ? `_${row.suffixe}` : ''
    const computed = provided ? undefined
      : `${String(row.commune_insee).toUpperCase()}_${code}_${number}${interopSuffix}`.toLowerCase()
    const selected = provided ? String(row.cle_interop) : computed!
    if (row.id_ban_adresse) {
      const identity = String(row.id_ban_adresse).toLowerCase()
      if (selectedByAddress.has(identity) && selectedByAddress.get(identity) !== selected) {
        throw new InvalidTargetKeyInput()
      }
      selectedByAddress.set(identity, selected)
    }
    const source = { ...row }
    delete source.ban_enrich_deprecated_cle_interop
    return {
      ...source,
      ...(computed === undefined ? {} : { ban_enrich_deprecated_cle_interop: computed }),
      ban_enrich_retained_cle_interop: selected,
      ban_enrich_ban_target_keys_address: [`${district}~${toponym}~${address}`],
      ban_enrich_ban_target_keys_toponym: [`${district}~${toponym}`],
      ban_enrich_ban_target_keys_district: [`${district}`],
    }
  })
  return { ...input.original, rows }
}
