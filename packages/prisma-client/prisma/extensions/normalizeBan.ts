// normalizeBan.ts

type AnyObj = Record<string, any>

function stableOrderObject(input: any, preferredKeys: string[] = []): any {
  if (Array.isArray(input)) return input.map((x) => stableOrderObject(x))
  if (!input || typeof input !== 'object') return input

  const obj = input as AnyObj
  const out: AnyObj = {}

  // 1) keys préférées (dans l'ordre)
  const preferred = preferredKeys.filter((k) => k in obj)
  for (const k of preferred) out[k] = stableOrderObject(obj[k])

  // 2) le reste trié alpha
  const restKeys = Object.keys(obj)
    .filter((k) => !preferred.includes(k))
    .sort()

  for (const k of restKeys) out[k] = stableOrderObject(obj[k])

  return out
}

const PREF_ADDRESS = [
  'id',
  'districtID',
  'mainCommonToponymID',
  'secondaryCommonToponymIDs',
  'number',
  'suffix',
  'range_validity',
  'validity',
  'updatedAtPrecise',
  'updateDate',
  'isActive',
  'certified',
  'labels',
  'positions',
  'meta',
]

const PREF_COMMON_TOPONYM = [
  'id',
  'districtID',
  'range_validity',
  'validity',
  'updatedAtPrecise',
  'updateDate',
  'isActive',
  'labels',
  'positions',
  'config',
  'meta',
]

const PREF_DISTRICT = [
  'id',
  'range_validity',
  'validity',
  'updatedAtPrecise',
  'updateDate',
  'isActive',
  'labels',
  'config',
  'meta',
]

export function normalizeBanAddress<T extends AnyObj>(obj: T): T {
  return stableOrderObject(obj, PREF_ADDRESS) as T
}

export function normalizeBanCommonToponym<T extends AnyObj>(obj: T): T {
  return stableOrderObject(obj, PREF_COMMON_TOPONYM) as T
}

export function normalizeBanDistrict<T extends AnyObj>(obj: T): T {
  return stableOrderObject(obj, PREF_DISTRICT) as T
}
