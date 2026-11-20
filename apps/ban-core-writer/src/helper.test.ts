import { describe, expect, it, vi } from 'vitest'

vi.mock('@ban/tools', () => ({ getUUIDv4: () => '00000000-0000-4000-8000-000000000099' }))

import { getBanObjectsFromBalRows } from './helper.js'

const ids = [1, 2, 3, 4].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`)
const row = (extra = {}) => ({
  id_ban_commune: ids[0], id_ban_toponyme: ids[1], id_ban_adresse: ids[2],
  commune_insee: '96001', commune_nom: 'Commune fictive', voie_nom: 'Voie fictive',
  numero: 12, position: 'entrée', long: 0, lat: 0, x: 0, y: 0, ...extra,
})

describe('writer target-key metadata preservation', () => {
  it('preserves source/calculated/retained meanings through actual persistence schemas', () => {
    const objects = getBanObjectsFromBalRows([row({
      cle_interop: '96002_a001_00012',
      ban_enrich_deprecated_cle_interop: '96001_abc123_00012',
      ban_enrich_retained_cle_interop: '96002_a001_00012',
      ban_enrich_ban_target_keys_address: ['96001~VOIE-FICTIVE~12'],
      ban_enrich_ban_target_keys_toponym: ['96001~VOIE-FICTIVE'],
      ban_enrich_ban_target_keys_district: ['96001'],
    })], 'fra')
    const address = objects.addresses[ids[2]]
    expect(address.meta.interop).toEqual({
      balProvidedKey: '96002_a001_00012', banComputedKey: '96001_abc123_00012',
    })
    expect(address.meta.interopSelection).toEqual({ retainedKey: '96002_a001_00012' })
    expect(address.meta.ban?.targetKeys).toEqual(['96001~VOIE-FICTIVE~12'])
    expect(objects.commonToponyms[ids[1]].meta.ban?.targetKeys)
      .toEqual(['96001~VOIE-FICTIVE'])
    expect(objects.districts[ids[0]].meta.ban?.targetKeys)
      .toEqual(['96001'])
  })

  it('does not manufacture a computed key for a permanent supplied key', () => {
    const objects = getBanObjectsFromBalRows([row({
      cle_interop: '96002_a001_00012', ban_enrich_retained_cle_interop: '96002_a001_00012',
    })], 'fra')
    const address = objects.addresses[ids[2]]
    expect(address.meta.interop).toEqual({ balProvidedKey: '96002_a001_00012' })
    expect(address.meta.interop).not.toHaveProperty('banComputedKey')
  })

  it('does not attribute the last address interop key to its district or toponym', () => {
    const objects = getBanObjectsFromBalRows([
      row({ cle_interop: '96001_a001_00012' }),
      row({ id_ban_adresse: ids[3], numero: 13, cle_interop: '96001_b002_00013' }),
    ], 'fra')
    for (const parent of [objects.districts[ids[0]], objects.commonToponyms[ids[1]]]) {
      expect(parent.meta).not.toHaveProperty('interop')
      expect(parent.meta.ban).not.toHaveProperty('DEPRECATED_cleInterop')
      expect(parent.meta.ban).not.toHaveProperty('DEPRECATED_cleInteropBAN')
    }
    expect(objects.commonToponyms[ids[1]].meta.ban.DEPRECATED_id).toBe('???')
  })

  it('accepts previous callers without enrichment and omits invented empty target keys', () => {
    const objects = getBanObjectsFromBalRows([row()], 'fra')
    for (const object of [objects.districts[ids[0]], objects.commonToponyms[ids[1]],
      objects.addresses[ids[2]]]) expect(object.meta.ban).not.toHaveProperty('targetKeys')
    expect(objects.addresses[ids[2]].meta).not.toHaveProperty('interop')
  })
})
